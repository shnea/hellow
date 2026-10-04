package kr.shnea.hellow.collaboration;

import static org.springframework.http.HttpStatus.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.*;
import kr.shnea.hellow.security.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class InternalChatService {
  public record Candidate(Long id, String name, boolean own) {}

  public record Participant(Long id, String name, long readSequence, boolean owner) {}

  public record RoomView(
      String id,
      long version,
      String kind,
      String name,
      long sequence,
      long unread,
      String preview,
      List<Participant> participants,
      boolean manageable,
      java.time.Instant updatedAt) {}

  public record RoomPage(List<RoomView> items, boolean hasMore) {}

  public record Create(String requestId, String kind, String name, List<Long> participantIds) {}

  public record Send(String clientMessageId, String body, List<String> attachmentIds) {}

  public record Message(
      long sequence,
      String senderName,
      boolean own,
      String clientMessageId,
      String body,
      List<WorkFiles.View> attachments,
      java.time.Instant createdAt) {}

  public record Conversation(RoomView room, List<Message> messages, long cursor, boolean hasMore) {}

  private final InternalRoomRepository rooms;
  private final InternalRoomMemberRepository participants;
  private final InternalMessageRepository messages;
  private final MembershipRepository members;
  private final CollaborationAccess commands;
  private final MembershipAccess authority;
  private final WorkspaceAccess access;
  private final WorkFiles files;
  private final AuditEvents audit;
  private final ObjectMapper json;
  private final Clock clock;

  public InternalChatService(
      InternalRoomRepository rooms,
      InternalRoomMemberRepository participants,
      InternalMessageRepository messages,
      MembershipRepository members,
      CollaborationAccess commands,
      MembershipAccess authority,
      WorkspaceAccess access,
      WorkFiles files,
      AuditEvents audit,
      ObjectMapper json,
      Clock clock) {
    this.rooms = rooms;
    this.participants = participants;
    this.messages = messages;
    this.members = members;
    this.commands = commands;
    this.authority = authority;
    this.access = access;
    this.files = files;
    this.audit = audit;
    this.json = json;
    this.clock = clock;
  }

  private Membership me(WorkspaceAccess.Actor a) {
    return members
        .findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(
            a.organizationId(), a.issuer(), a.subject())
        .orElseThrow(() -> new ResponseStatusException(FORBIDDEN));
  }

  private Membership eligible(String org, Long id) {
    return members
        .findById(id)
        .filter(
            m ->
                m.getOrganizationId().equals(org)
                    && m.isActive()
                    && !m.isDeleted()
                    && authority.grants(m).containsKey("internal-chat:read"))
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "활성 채팅 참여자를 찾을 수 없습니다."));
  }

  private InternalRoomMember participation(WorkspaceAccess.Actor a, InternalRoom r) {
    return participants
        .findByRoomIdAndMembershipId(r.id, me(a).getId())
        .filter(p -> p.active)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "참여 중인 대화방이 아닙니다."));
  }

  private InternalRoom room(WorkspaceAccess.Actor a, String id, boolean lock) {
    var r =
        (lock
                ? rooms.lock(a.organizationId(), id)
                : rooms.findByOrganizationIdAndId(a.organizationId(), id))
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "대화방을 찾을 수 없습니다."));
    participation(a, r);
    return r;
  }

  private List<Participant> participantViews(InternalRoom r) {
    var out = new ArrayList<Participant>();
    for (var p : participants.findByRoomIdOrderByJoinedAt(r.id))
      if (p.active) {
        var m =
            members
                .findById(p.membershipId)
                .filter(
                    member ->
                        member.isActive()
                            && !member.isDeleted()
                            && authority.grants(member).containsKey("internal-chat:read"));
        m.ifPresent(
            member ->
                out.add(
                    new Participant(
                        member.getId(),
                        StaffNames.display(member.getDisplayName(), member.getLoginId()),
                        p.readSequence,
                        member.getId().equals(r.creatorMemberId))));
      }
    return out;
  }

  private RoomView view(WorkspaceAccess.Actor a, InternalRoom r) {
    var p = participation(a, r);
    var people = participantViews(r);
    var last = messages.findByRoomIdOrderBySequenceDesc(r.id, PageRequest.of(0, 1));
    String preview = last.isEmpty() ? "" : last.getFirst().body;
    if (preview.isBlank() && !last.isEmpty()) preview = "첨부파일";
    if (preview.length() > 100) preview = preview.substring(0, 100);
    String name =
        r.kind.equals("DIRECT")
            ? people.stream()
                .filter(m -> !m.id().equals(p.membershipId))
                .map(Participant::name)
                .findFirst()
                .orElse("참여자가 없는 1:1 대화")
            : r.name;
    return new RoomView(
        r.id,
        r.version,
        r.kind,
        name,
        r.sequence,
        messages.countByRoomIdAndSequenceGreaterThan(r.id, p.readSequence),
        preview,
        people,
        r.kind.equals("GROUP") && r.creatorMemberId.equals(p.membershipId),
        r.updatedAt);
  }

  private String uuid(String id) {
    try {
      return UUID.fromString(id).toString();
    } catch (Exception e) {
      throw new ResponseStatusException(BAD_REQUEST, "요청 ID를 확인해 주세요.");
    }
  }

  private List<String> refs(String data) {
    try {
      return json.readValue(
          data, json.getTypeFactory().constructCollectionType(List.class, String.class));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private String serialize(List<String> data) {
    try {
      return json.writeValueAsString(data);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private Message message(WorkspaceAccess.Actor a, InternalRoom r, InternalMessage m) {
    return new Message(
        m.sequence,
        m.senderName,
        m.senderIssuer.equals(a.issuer()) && m.senderSubject.equals(a.subject()),
        m.clientMessageId,
        m.body,
        refs(m.attachmentIds).stream()
            .map(id -> files.view(files.get(a.organizationId(), "ROOM", r.id, id)))
            .toList(),
        m.createdAt);
  }

  @Transactional(readOnly = true)
  public List<Candidate> candidates() {
    var a = access.require("internal-chat:read");
    return members.findByOrganizationIdOrderById(a.organizationId()).stream()
        .filter(
            m ->
                m.isActive()
                    && !m.isDeleted()
                    && authority.grants(m).containsKey("internal-chat:read"))
        .map(
            m ->
                new Candidate(
                    m.getId(),
                    StaffNames.display(m.getDisplayName(), m.getLoginId()),
                    m.getId().equals(me(a).getId())))
        .toList();
  }

  @Transactional(readOnly = true)
  public RoomPage list(int page) {
    var a = access.require("internal-chat:read");
    if (page < 0 || page > 100000) throw new ResponseStatusException(BAD_REQUEST);
    var rows = rooms.rooms(a.organizationId(), me(a).getId(), PageRequest.of(page, 30));
    return new RoomPage(rows.getContent().stream().map(r -> view(a, r)).toList(), rows.hasNext());
  }

  private void join(InternalRoom r, Long member) {
    var p =
        participants
            .findByRoomIdAndMembershipId(r.id, member)
            .orElseGet(
                () -> {
                  var fresh = new InternalRoomMember();
                  fresh.id = UUID.randomUUID().toString();
                  fresh.roomId = r.id;
                  fresh.membershipId = member;
                  return fresh;
                });
    if (p.active) return;
    p.active = true;
    p.joinedAt = clock.instant();
    p.leftAt = null;
    participants.saveAndFlush(p);
  }

  @Transactional
  public RoomView create(Create c) {
    var a = commands.command("internal-chat:write");
    access.require("internal-chat:read");
    var creator = me(a);
    String request = uuid(c.requestId());
    if (!Set.of("DIRECT", "GROUP").contains(Objects.toString(c.kind(), ""))
        || c.participantIds() == null
        || c.participantIds().isEmpty()
        || c.participantIds().contains(null)
        || c.participantIds().size() > 49
        || new HashSet<>(c.participantIds()).size() != c.participantIds().size()
        || c.participantIds().contains(creator.getId())
        || c.kind().equals("DIRECT") && c.participantIds().size() != 1
        || c.kind().equals("GROUP")
            && (c.name() == null || c.name().isBlank() || c.name().length() > 150))
      throw new ResponseStatusException(BAD_REQUEST, "방 종류·이름·참여자를 확인해 주세요.");
    var selected = new TreeSet<Long>(c.participantIds());
    selected.add(creator.getId());
    for (var id : selected) eligible(a.organizationId(), id);
    String key =
        c.kind().equals("DIRECT")
            ? "direct:" + selected
            : "group:" + a.issuer() + ":" + a.subject() + ":" + request;
    key = UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)).toString();
    var old = rooms.findByOrganizationIdAndCreationKey(a.organizationId(), key);
    if (old.isPresent()) {
      var r = old.get();
      if (c.kind().equals("DIRECT")) {
        join(r, creator.getId());
        return view(a, r);
      }
      participation(a, r);
      if (!r.name.equals(c.name().trim())
          || !new TreeSet<>(
                  participants.findByRoomIdOrderByJoinedAt(r.id).stream()
                      .map(p -> p.membershipId)
                      .toList())
              .equals(selected))
        throw new ResponseStatusException(CONFLICT, "같은 작성 ID의 대화방이 변경되었습니다.");
      return view(a, r);
    }
    var r = new InternalRoom();
    r.id = UUID.randomUUID().toString();
    r.setOrganizationId(a.organizationId());
    r.assignOwner(a);
    r.kind = c.kind();
    r.name = c.kind().equals("DIRECT") ? "1:1 대화" : c.name().trim();
    r.creationKey = key;
    r.creatorMemberId = creator.getId();
    r.createdAt = clock.instant();
    r.updatedAt = r.createdAt;
    rooms.saveAndFlush(r);
    for (var id : selected) join(r, id);
    audit.record(a.organizationId(), "internal-chat.created", r.id, "kind=" + r.kind);
    return view(a, r);
  }

  @Transactional(readOnly = true)
  public Conversation read(WorkspaceAccess.Actor a, String id, long after) {
    if (after < 0) throw new ResponseStatusException(BAD_REQUEST);
    var r = room(a, id, false);
    if (after > r.sequence) throw new ResponseStatusException(BAD_REQUEST, "대화 위치를 다시 확인해 주세요.");
    var rows =
        messages.findByRoomIdAndSequenceGreaterThanOrderBySequence(
            id, after, PageRequest.of(0, 100));
    long cursor = rows.isEmpty() ? after : rows.getContent().getLast().sequence;
    return new Conversation(
        view(a, r),
        rows.getContent().stream().map(m -> message(a, r, m)).toList(),
        cursor,
        rows.hasNext());
  }

  @Transactional
  public Message send(String id, Send s) {
    var a = commands.command("internal-chat:write");
    access.require("internal-chat:read");
    var r = room(a, id, true);
    var current = access.require("internal-chat:write");
    access.require("internal-chat:read");
    participation(current, r);
    String request = uuid(s.clientMessageId());
    if (s.body() == null
        || s.body().length() > 10000
        || s.attachmentIds() == null
        || s.attachmentIds().size() > 5
        || s.body().isBlank() && s.attachmentIds().isEmpty()
        || new HashSet<>(s.attachmentIds()).size() != s.attachmentIds().size())
      throw new ResponseStatusException(BAD_REQUEST, "메시지는1~10,000자 또는 첨부파일을 포함해야 합니다.");
    var old =
        messages.findByRoomIdAndSenderIssuerAndSenderSubjectAndClientMessageId(
            id, a.issuer(), a.subject(), request);
    if (old.isPresent()) {
      var m = old.get();
      if (!m.body.equals(s.body()) || !refs(m.attachmentIds).equals(s.attachmentIds()))
        throw new ResponseStatusException(CONFLICT, "같은 전송 ID의 내용이 변경되었습니다.");
      return message(a, r, m);
    }
    var attachments = new ArrayList<WorkFile>();
    for (var file : s.attachmentIds()) {
      var f = files.get(a.organizationId(), "ROOM", id, file);
      if (f.messageSequence != null
          || !f.uploaderIssuer.equals(a.issuer())
          || !f.uploaderSubject.equals(a.subject()))
        throw new ResponseStatusException(CONFLICT, "본인이 업로드한 새 첨부파일을 선택해 주세요.");
      attachments.add(f);
    }
    r.sequence++;
    r.updatedAt = clock.instant();
    var m = new InternalMessage();
    m.roomId = id;
    m.sequence = r.sequence;
    m.senderIssuer = a.issuer();
    m.senderSubject = a.subject();
    m.senderName = a.name();
    m.clientMessageId = request;
    m.body = s.body();
    m.attachmentIds = serialize(s.attachmentIds());
    m.createdAt = clock.instant();
    messages.saveAndFlush(m);
    attachments.forEach(f -> f.messageSequence = m.sequence);
    rooms.saveAndFlush(r);
    return message(a, r, m);
  }

  @Transactional
  public RoomView markRead(String id, long sequence) {
    var a = commands.command("internal-chat:read");
    var r = room(a, id, true);
    a = access.require("internal-chat:read");
    if (sequence < 0 || sequence > r.sequence) throw new ResponseStatusException(BAD_REQUEST);
    var p = participation(a, r);
    p.readSequence = Math.max(p.readSequence, sequence);
    participants.saveAndFlush(p);
    return view(a, r);
  }

  private void expected(InternalRoom r, long version) {
    if (r.version != version)
      throw new ResponseStatusException(CONFLICT, "대화방 정보가 변경됐습니다. 다시 확인해 주세요.");
  }

  @Transactional
  public RoomView manage(String id, long version, String name, List<Long> add, List<Long> remove) {
    var a = commands.command("internal-chat:write");
    access.require("internal-chat:read");
    var r = room(a, id, true);
    a = access.require("internal-chat:read");
    participation(a, r);
    expected(r, version);
    access.require("internal-chat:write");
    if (!r.kind.equals("GROUP") || !r.creatorMemberId.equals(me(a).getId()))
      throw new ResponseStatusException(FORBIDDEN, "그룹을 만든 참여자만 방을 관리할 수 있습니다.");
    if (name == null
        || name.isBlank()
        || name.length() > 150
        || add == null
        || remove == null
        || add.size() > 49
        || remove.size() > 49
        || add.contains(null)
        || remove.contains(null)
        || new HashSet<>(add).size() != add.size()
        || new HashSet<>(remove).size() != remove.size()
        || remove.contains(r.creatorMemberId)
        || !Collections.disjoint(add, remove))
      throw new ResponseStatusException(BAD_REQUEST, "그룹 이름과 참여자를 확인해 주세요.");
    for (var member : add) {
      eligible(a.organizationId(), member);
      join(r, member);
    }
    for (var member : remove) {
      var p =
          participants
              .findByRoomIdAndMembershipId(id, member)
              .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
      p.active = false;
      p.leftAt = clock.instant();
      participants.save(p);
    }
    if (participants.findByRoomIdOrderByJoinedAt(id).stream().filter(p -> p.active).count() > 50)
      throw new ResponseStatusException(BAD_REQUEST, "그룹은 최대50명까지 참여할 수 있습니다.");
    r.name = name.trim();
    r.updatedAt = clock.instant();
    rooms.saveAndFlush(r);
    audit.record(
        a.organizationId(),
        "internal-chat.members",
        id,
        "added=" + add.size() + ";removed=" + remove.size());
    return view(a, r);
  }

  @Transactional
  public void leave(String id, long version) {
    var a = commands.command("internal-chat:read");
    var r = room(a, id, true);
    a = access.require("internal-chat:read");
    participation(a, r);
    expected(r, version);
    var p = participation(a, r);
    if (r.kind.equals("GROUP")
        && p.membershipId.equals(r.creatorMemberId)
        && participants.findByRoomIdOrderByJoinedAt(id).stream()
            .anyMatch(other -> other.active && !other.membershipId.equals(p.membershipId)))
      throw new ResponseStatusException(CONFLICT, "그룹 관리자는 다른 참여자를 제거한 뒤 나갈 수 있습니다.");
    p.active = false;
    p.leftAt = clock.instant();
    r.updatedAt = clock.instant();
    rooms.saveAndFlush(r);
    participants.saveAndFlush(p);
    audit.record(a.organizationId(), "internal-chat.left", id, "");
  }

  @Transactional
  public WorkFiles.View upload(String id, String request, MultipartFile file)
      throws java.io.IOException {
    var a = commands.command("internal-chat:write");
    access.require("internal-chat:read");
    var r = room(a, id, true);
    a = access.require("internal-chat:write");
    access.require("internal-chat:read");
    participation(a, r);
    return files.view(files.upload(a, "ROOM", r.id, request, file));
  }

  @Transactional(readOnly = true)
  public Map<String, Object> ticket(String id, String file) {
    var a = access.require("internal-chat:read");
    var r = room(a, id, false);
    var f = files.get(a.organizationId(), "ROOM", r.id, file);
    if (f.messageSequence == null
        && (!f.uploaderIssuer.equals(a.issuer()) || !f.uploaderSubject.equals(a.subject())))
      throw new ResponseStatusException(NOT_FOUND);
    return files.ticket(f);
  }
}
