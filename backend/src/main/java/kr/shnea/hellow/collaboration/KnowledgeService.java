package kr.shnea.hellow.collaboration;

import static org.springframework.http.HttpStatus.*;

import com.fasterxml.jackson.databind.*;
import jakarta.persistence.criteria.*;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.*;
import kr.shnea.hellow.security.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class KnowledgeService {
  public record Write(
      String requestId,
      Long expectedVersion,
      String title,
      String category,
      String kind,
      String visibility,
      JsonNode document,
      List<String> attachmentIds) {}

  public record View(
      String id,
      long version,
      String title,
      String category,
      String kind,
      String visibility,
      String state,
      long revision,
      Long publishedRevision,
      boolean unpublishedChanges,
      String document,
      List<WorkFiles.View> attachments,
      String authorName,
      java.time.Instant updatedAt,
      boolean editable,
      boolean publishable) {}

  public record PageView(List<View> items, boolean hasMore) {}

  public record RevisionView(
      long revision,
      String title,
      String category,
      String kind,
      String visibility,
      String document,
      List<WorkFiles.View> attachments,
      String editorName,
      java.time.Instant createdAt) {}

  private final KnowledgeRepository documents;
  private final KnowledgeRevisionRepository revisions;
  private final WorkFiles files;
  private final WorkspaceAccess access;
  private final AuditEvents audit;
  private final ObjectMapper json;
  private final Clock clock;
  private final CollaborationAccess commands;

  public KnowledgeService(
      KnowledgeRepository documents,
      KnowledgeRevisionRepository revisions,
      WorkFiles files,
      WorkspaceAccess access,
      AuditEvents audit,
      ObjectMapper json,
      Clock clock,
      CollaborationAccess commands) {
    this.commands = commands;
    this.documents = documents;
    this.revisions = revisions;
    this.files = files;
    this.access = access;
    this.audit = audit;
    this.json = json;
    this.clock = clock;
  }

  private boolean owner(WorkspaceAccess.Actor a, KnowledgeDocument d) {
    return a.issuer().equals(d.getOwnerIssuer()) && a.subject().equals(d.getOwnerSubject());
  }

  private boolean editor(WorkspaceAccess.Actor a, KnowledgeDocument d) {
    return a.can("knowledge:write", d) || a.can("knowledge:publish", d);
  }

  private boolean audience(WorkspaceAccess.Actor a, KnowledgeDocument d) {
    return owner(a, d)
        || "ORGANIZATION".equals(d.publishedVisibility)
        || "TEAM".equals(d.publishedVisibility)
            && d.getTeamId() != null
            && a.teamIds().contains(d.getTeamId());
  }

  private void readable(WorkspaceAccess.Actor a, KnowledgeDocument d) {
    if (!editor(a, d)
        && !(d.state.equals("PUBLISHED") && audience(a, d) && a.can("knowledge:read", d)))
      throw new ResponseStatusException(NOT_FOUND, "문서를 찾을 수 없습니다.");
  }

  KnowledgeDocument get(WorkspaceAccess.Actor a, String id, boolean lock) {
    var d =
        (lock
                ? documents.lock(a.organizationId(), id)
                : documents.findByOrganizationIdAndId(a.organizationId(), id))
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "문서를 찾을 수 없습니다."));
    readable(a, d);
    return d;
  }

  private List<String> ids(String data) {
    try {
      return json.readValue(
          data, json.getTypeFactory().constructCollectionType(List.class, String.class));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private String serialized(List<String> ids) {
    try {
      return json.writeValueAsString(ids);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private List<WorkFiles.View> attachmentViews(KnowledgeDocument d, String refs) {
    return ids(refs).stream()
        .map(id -> files.view(files.get(d.getOrganizationId(), "KNOWLEDGE", d.id, id)))
        .toList();
  }

  private KnowledgeRevision revision(KnowledgeDocument d, long n) {
    return revisions
        .findByDocumentIdAndRevision(d.id, n)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
  }

  private View view(WorkspaceAccess.Actor a, KnowledgeDocument d) {
    boolean draft = editor(a, d);
    var r = revision(d, draft ? d.draftRevision : d.publishedRevision);
    return new View(
        d.id,
        d.version,
        r.title,
        r.category,
        r.kind,
        r.visibility,
        d.state,
        r.revision,
        d.publishedRevision,
        d.publishedRevision == null || d.draftRevision != d.publishedRevision,
        r.document,
        attachmentViews(d, r.attachmentIds),
        d.authorName,
        d.updatedAt,
        a.can("knowledge:write", d),
        a.can("knowledge:publish", d));
  }

  private Predicate scope(
      WorkspaceAccess.Actor a, String permission, Root<KnowledgeDocument> r, CriteriaBuilder c) {
    var grant = a.grants().get(permission);
    if (grant == null) return c.disjunction();
    if (grant == DataScope.ORGANIZATION) return c.conjunction();
    var own =
        c.and(
            c.equal(r.get("ownerIssuer"), a.issuer()), c.equal(r.get("ownerSubject"), a.subject()));
    return grant == DataScope.TEAM && !a.teamIds().isEmpty()
        ? c.or(own, r.get("teamId").in(a.teamIds()))
        : own;
  }

  @Transactional(readOnly = true)
  public PageView list(String query, String state, String kind, int page) {
    var a = access.requireAny("knowledge:read", "knowledge:write", "knowledge:publish");
    if (page < 0
        || page > 100000
        || query.length() > 200
        || !Set.of("", "DRAFT", "PUBLISHED", "ARCHIVED").contains(state)
        || !Set.of("", "DOCUMENT", "FAQ").contains(kind))
      throw new ResponseStatusException(BAD_REQUEST);
    var rows =
        documents.findAll(
            (r, q, c) -> {
              var edit =
                  c.or(scope(a, "knowledge:write", r, c), scope(a, "knowledge:publish", r, c));
              var own =
                  c.and(
                      c.equal(r.get("ownerIssuer"), a.issuer()),
                      c.equal(r.get("ownerSubject"), a.subject()));
              var team = a.teamIds().isEmpty() ? c.disjunction() : r.get("teamId").in(a.teamIds());
              var audience =
                  c.or(
                      own,
                      c.equal(r.get("publishedVisibility"), "ORGANIZATION"),
                      c.and(c.equal(r.get("publishedVisibility"), "TEAM"), team));
              var pub =
                  c.and(
                      c.equal(r.get("state"), "PUBLISHED"),
                      scope(a, "knowledge:read", r, c),
                      audience);
              var predicates = new ArrayList<Predicate>();
              predicates.add(c.equal(r.get("organizationId"), a.organizationId()));
              predicates.add(c.or(edit, pub));
              if (!state.isEmpty()) predicates.add(c.equal(r.get("state"), state));
              if (!kind.isEmpty())
                predicates.add(
                    c.or(
                        c.and(edit, c.equal(r.get("kind"), kind)),
                        c.and(c.not(edit), c.equal(r.get("publishedKind"), kind))));
              if (!query.isBlank()) {
                String term =
                    "%"
                        + query
                            .toLowerCase(Locale.ROOT)
                            .replace("\\", "\\\\")
                            .replace("%", "\\%")
                            .replace("_", "\\_")
                        + "%";
                var draftMatch =
                    c.or(
                        c.like(c.lower(r.get("title")), term, '\\'),
                        c.like(c.lower(r.get("category")), term, '\\'),
                        c.like(c.lower(r.get("bodyText")), term, '\\'));
                var publishedMatch =
                    c.or(
                        c.like(c.lower(r.get("publishedTitle")), term, '\\'),
                        c.like(c.lower(r.get("publishedCategory")), term, '\\'),
                        c.like(c.lower(r.get("publishedBodyText")), term, '\\'));
                predicates.add(c.or(c.and(edit, draftMatch), c.and(c.not(edit), publishedMatch)));
              }
              return c.and(predicates.toArray(Predicate[]::new));
            },
            PageRequest.of(page, 30, Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.asc("id"))));
    return new PageView(rows.getContent().stream().map(d -> view(a, d)).toList(), rows.hasNext());
  }

  @Transactional(readOnly = true)
  public View read(String id) {
    var a = access.requireAny("knowledge:read", "knowledge:write", "knowledge:publish");
    return view(a, get(a, id, false));
  }

  private void validate(WorkspaceAccess.Actor a, String id, Write w) {
    if (w.expectedVersion() == null
        || w.expectedVersion() < 0
        || w.title() == null
        || w.title().isBlank()
        || w.title().length() > 200
        || w.category() == null
        || w.category().length() > 100
        || !Set.of("DOCUMENT", "FAQ").contains(Objects.toString(w.kind(), ""))
        || !Set.of("SELF", "TEAM", "ORGANIZATION").contains(Objects.toString(w.visibility(), ""))
        || w.visibility().equals("TEAM") && a.teamId() == null
        || w.document() == null
        || w.document().toString().length() > 200000
        || !w.document().path("format").asText().equals("shnea-editor")
        || !w.document().path("content").isObject()
        || w.attachmentIds() == null
        || w.attachmentIds().size() > 50
        || new HashSet<>(w.attachmentIds()).size() != w.attachmentIds().size())
      throw new ResponseStatusException(BAD_REQUEST, "문서 제목·종류·공개 범위·본문을 확인해 주세요.");
    for (String file : w.attachmentIds()) files.get(a.organizationId(), "KNOWLEDGE", id, file);
    validateNode(a, id, w.document(), 0);
  }

  private void validateNode(WorkspaceAccess.Actor a, String id, JsonNode node, int depth) {
    if (depth > 64) throw new ResponseStatusException(BAD_REQUEST, "문서 구조가 너무 깊습니다.");
    if (node.isObject()) {
      if (node.has("fileId"))
        files.get(a.organizationId(), "KNOWLEDGE", id, node.path("fileId").asText());
      for (String key : List.of("href", "src", "url"))
        if (node.has(key) && node.get(key).isTextual()) {
          String url = node.get(key).asText();
          if (!url.isBlank() && !url.matches("(?i)https?://.*") && !url.startsWith("/"))
            throw new ResponseStatusException(BAD_REQUEST, "문서 링크 형식을 확인해 주세요.");
        }
    }
    if (node.isContainerNode()) node.forEach(n -> validateNode(a, id, n, depth + 1));
  }

  private String text(JsonNode n) {
    var out = new StringBuilder();
    collect(n, out);
    return out.toString();
  }

  private void collect(JsonNode n, StringBuilder out) {
    if (n.isObject() && n.has("text")) out.append(n.path("text").asText()).append(' ');
    if (n.isContainerNode()) n.forEach(x -> collect(x, out));
  }

  private void snapshot(WorkspaceAccess.Actor a, KnowledgeDocument d) {
    var r = new KnowledgeRevision();
    r.documentId = d.id;
    r.revision = d.draftRevision;
    r.title = d.title;
    r.category = d.category;
    r.kind = d.kind;
    r.visibility = d.visibility;
    r.document = d.document;
    r.attachmentIds = d.attachmentIds;
    r.editorIssuer = a.issuer();
    r.editorSubject = a.subject();
    r.editorName = a.name();
    r.createdAt = clock.instant();
    revisions.saveAndFlush(r);
  }

  private void apply(KnowledgeDocument d, Write w) {
    d.title = w.title().trim();
    d.category = w.category().trim();
    d.kind = w.kind();
    d.visibility = w.visibility();
    d.document = w.document().toString();
    d.bodyText = text(w.document());
    d.attachmentIds = serialized(w.attachmentIds());
    d.updatedAt = clock.instant();
  }

  @Transactional
  public View create(Write w) {
    var a = commands.command("knowledge:write");
    String request;
    try {
      request = UUID.fromString(w.requestId()).toString();
    } catch (Exception e) {
      throw new ResponseStatusException(BAD_REQUEST, "문서 작성 ID를 확인해 주세요.");
    }
    String id =
        UUID.nameUUIDFromBytes(
                (a.organizationId() + ":" + a.issuer() + ":" + a.subject() + ":" + request)
                    .getBytes(StandardCharsets.UTF_8))
            .toString();
    validate(a, id, w);
    var existing = documents.findByOrganizationIdAndId(a.organizationId(), id);
    if (existing.isPresent()) {
      var d = existing.get();
      var first = revision(d, 1);
      if (!first.title.equals(w.title().trim())
          || !first.document.equals(w.document().toString())
          || !first.category.equals(w.category().trim())
          || !first.kind.equals(w.kind())
          || !first.visibility.equals(w.visibility())
          || !ids(first.attachmentIds).equals(w.attachmentIds()))
        throw new ResponseStatusException(CONFLICT, "같은 작성 ID의 내용이 다릅니다.");
      readable(a, d);
      return view(a, d);
    }
    if (w.expectedVersion() != 0) throw new ResponseStatusException(CONFLICT);
    var d = new KnowledgeDocument();
    d.id = id;
    d.setOrganizationId(a.organizationId());
    d.assignOwner(a);
    d.authorName = a.name();
    d.state = "DRAFT";
    d.draftRevision = 1;
    d.createdAt = clock.instant();
    apply(d, w);
    documents.saveAndFlush(d);
    snapshot(a, d);
    audit.record(a.organizationId(), "knowledge.created", d.id, "revision=1");
    return view(a, d);
  }

  @Transactional
  public View update(String id, Write w) {
    var a = commands.command("knowledge:write");
    var d = get(a, id, true);
    a = access.require("knowledge:write");
    if (!a.can("knowledge:write", d)) throw new ResponseStatusException(NOT_FOUND);
    validate(a, id, w);
    version(d, w.expectedVersion());
    if (d.state.equals("ARCHIVED"))
      throw new ResponseStatusException(CONFLICT, "보관된 문서는 먼저 복원해 주세요.");
    apply(d, w);
    d.draftRevision++;
    documents.saveAndFlush(d);
    snapshot(a, d);
    audit.record(a.organizationId(), "knowledge.edited", d.id, "revision=" + d.draftRevision);
    return view(a, d);
  }

  private void version(KnowledgeDocument d, Long n) {
    if (n == null || d.version != n)
      throw new ResponseStatusException(CONFLICT, "문서가 변경됐습니다. 입력을 보존하고 최신 버전을 확인해 주세요.");
  }

  @Transactional
  public View transition(String id, String action, long version) {
    var a = commands.command("knowledge:publish");
    var d = get(a, id, true);
    a = access.require("knowledge:publish");
    if (!a.can("knowledge:publish", d)) throw new ResponseStatusException(NOT_FOUND);
    version(d, version);
    switch (action) {
      case "publish" -> {
        if (d.state.equals("ARCHIVED"))
          throw new ResponseStatusException(CONFLICT, "보관 문서는 먼저 초안으로 복원해 주세요.");
        d.publishedRevision = d.draftRevision;
        d.publishedTitle = d.title;
        d.publishedCategory = d.category;
        d.publishedBodyText = d.bodyText;
        d.publishedVisibility = d.visibility;
        d.publishedKind = d.kind;
        d.state = "PUBLISHED";
      }
      case "archive" -> d.state = "ARCHIVED";
      case "restore" -> d.state = "DRAFT";
      default -> throw new ResponseStatusException(NOT_FOUND);
    }
    d.updatedAt = clock.instant();
    documents.saveAndFlush(d);
    audit.record(a.organizationId(), "knowledge." + action, d.id, "revision=" + d.draftRevision);
    return view(a, d);
  }

  public record RevisionPage(List<RevisionView> items, boolean hasMore) {}

  @Transactional(readOnly = true)
  public RevisionPage history(String id, int page) {
    if (page < 0 || page > 100000) throw new ResponseStatusException(BAD_REQUEST);
    var a = access.requireAny("knowledge:write", "knowledge:publish");
    var d = get(a, id, false);
    if (!editor(a, d)) throw new ResponseStatusException(NOT_FOUND);
    var rows = revisions.findByDocumentIdOrderByRevisionDesc(id, PageRequest.of(page, 30));
    return new RevisionPage(
        rows.getContent().stream()
            .map(
                r ->
                    new RevisionView(
                        r.revision,
                        r.title,
                        r.category,
                        r.kind,
                        r.visibility,
                        r.document,
                        attachmentViews(d, r.attachmentIds),
                        r.editorName,
                        r.createdAt))
            .toList(),
        rows.hasNext());
  }

  @Transactional
  public WorkFiles.View upload(String id, String request, MultipartFile file)
      throws java.io.IOException {
    var a = commands.command("knowledge:write");
    var d = get(a, id, true);
    a = access.require("knowledge:write");
    if (!a.can("knowledge:write", d) || d.state.equals("ARCHIVED"))
      throw new ResponseStatusException(NOT_FOUND);
    return files.view(files.upload(a, "KNOWLEDGE", id, request, file));
  }

  @Transactional(readOnly = true)
  public Map<String, Object> ticket(String id, String file) {
    var a = access.requireAny("knowledge:read", "knowledge:write", "knowledge:publish");
    var d = get(a, id, false);
    var f = files.get(a.organizationId(), "KNOWLEDGE", id, file);
    if (!editor(a, d)
        && !ids(revision(d, d.publishedRevision).attachmentIds).contains(file)
        && !revision(d, d.publishedRevision).document.contains("\"fileId\":\"" + file + "\""))
      throw new ResponseStatusException(NOT_FOUND);
    return files.ticket(f);
  }
}
