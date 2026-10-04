package kr.shnea.hellow.collaboration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import java.util.concurrent.*;
import kr.shnea.hellow.platform.*;
import kr.shnea.hellow.security.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:collaboration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
      "platform.api-key=fixture-key"
    })
@AutoConfigureMockMvc
class TeamCollaborationIntegrationTest {
  static final String ISSUER = "https://identity.example/realms/test";
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired OrganizationRepository orgs;
  @Autowired MembershipRepository members;
  @Autowired AuditEventRepository audits;
  @Autowired KnowledgeRepository documents;
  @Autowired KnowledgeRevisionRepository revisions;
  @Autowired InternalRoomRepository rooms;
  @Autowired InternalRoomMemberRepository participants;
  @Autowired InternalMessageRepository messages;
  @Autowired WorkFileRepository files;
  @Autowired TeamRepository teams;
  @MockitoBean JwtDecoder decoder;
  @MockitoBean PlatformClient platform;
  Long alice, bob, outsider;

  @BeforeEach
  void setup() {
    files.deleteAll();
    messages.deleteAll();
    participants.deleteAll();
    rooms.deleteAll();
    revisions.deleteAll();
    documents.deleteAll();
    audits.deleteAll();
    members.deleteAll();
    teams.deleteAll();
    orgs.deleteAll();
    orgs.save(new Organization("a", "A", "public-a"));
    orgs.save(new Organization("b", "B", "public-b"));
    alice =
        members
            .save(new Membership("a", ISSUER, "alice", OrganizationAdminController.PERMISSIONS))
            .getId();
    bob =
        members
            .save(
                new Membership(
                    "a",
                    ISSUER,
                    "bob",
                    Set.of("knowledge:read", "internal-chat:read", "internal-chat:write")))
            .getId();
    outsider =
        members
            .save(new Membership("b", ISSUER, "eve", OrganizationAdminController.PERMISSIONS))
            .getId();
    members.save(new Membership("a", ISSUER, "admin", OrganizationAdminController.PERMISSIONS));
  }

  MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder r, String who, String org) {
    return r.with(jwt().jwt(j -> j.subject(who).issuer(ISSUER))).header("X-Organization-ID", org);
  }

  JsonNode response(ResultActions r) throws Exception {
    return json.readTree(
        r.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
  }

  String body(Object b) throws Exception {
    return json.writeValueAsString(b);
  }

  Map<String, Object> write(
      long version, String title, String visibility, String kind, String request) {
    return Map.of(
        "expectedVersion",
        version,
        "requestId",
        request,
        "title",
        title,
        "category",
        "검증",
        "visibility",
        visibility,
        "kind",
        kind,
        "attachmentIds",
        List.of(),
        "document",
        Map.of(
            "format",
            "shnea-editor",
            "content",
            Map.of(
                "type",
                "doc",
                "content",
                List.of(
                    Map.of(
                        "type",
                        "paragraph",
                        "content",
                        List.of(Map.of("type", "text", "text", title + " 본문")))))));
  }

  JsonNode create(String title, String visibility) throws Exception {
    return response(
        mvc.perform(
            actor(post("/api/knowledge"), "alice", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(write(0, title, visibility, "DOCUMENT", UUID.randomUUID().toString())))));
  }

  JsonNode transition(JsonNode d, String action) throws Exception {
    return response(
        mvc.perform(
            actor(post("/api/knowledge/" + d.path("id").asText() + "/" + action), "alice", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("expectedVersion", d.path("version").asLong())))));
  }

  JsonNode direct() throws Exception {
    return response(
        mvc.perform(
            actor(post("/api/internal-chat/rooms"), "alice", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(
                        Map.of(
                            "requestId",
                            UUID.randomUUID(),
                            "kind",
                            "DIRECT",
                            "name",
                            "",
                            "participantIds",
                            List.of(bob))))));
  }

  JsonNode send(String room, String who, String id, String text) throws Exception {
    return response(
        mvc.perform(
            actor(post("/api/internal-chat/rooms/" + room + "/messages"), who, "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(
                        Map.of("clientMessageId", id, "body", text, "attachmentIds", List.of())))));
  }

  @Test
  void publishedOriginalAudienceKindAndSearchRemainUntilRepublish() throws Exception {
    var d = create("원래 게시", "ORGANIZATION");
    String id = d.path("id").asText();
    mvc.perform(actor(get("/api/knowledge/" + id), "bob", "a")).andExpect(status().isNotFound());
    d = transition(d, "publish");
    var changed =
        response(
            mvc.perform(
                actor(put("/api/knowledge/" + id), "alice", "a")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        body(
                            write(
                                d.path("version").asLong(),
                                "새 초안",
                                "SELF",
                                "FAQ",
                                UUID.randomUUID().toString())))));
    mvc.perform(actor(get("/api/knowledge/" + id), "bob", "a"))
        .andExpect(jsonPath("$.title").value("원래 게시"))
        .andExpect(jsonPath("$.visibility").value("ORGANIZATION"));
    mvc.perform(actor(get("/api/knowledge?q=원래&kind=DOCUMENT"), "bob", "a"))
        .andExpect(jsonPath("$.items.length()").value(1));
    mvc.perform(actor(get("/api/knowledge?q=새 초안"), "bob", "a"))
        .andExpect(jsonPath("$.items.length()").value(0));
    mvc.perform(actor(get("/api/knowledge/" + id + "/revisions"), "bob", "a"))
        .andExpect(status().isForbidden());
    changed = transition(changed, "publish");
    mvc.perform(actor(get("/api/knowledge/" + id), "bob", "a")).andExpect(status().isNotFound());
    changed = transition(changed, "archive");
    mvc.perform(actor(get("/api/knowledge"), "bob", "a"))
        .andExpect(jsonPath("$.items.length()").value(0));
    transition(changed, "restore");
    assertThat(revisions.count()).isEqualTo(2);
  }

  @Test
  void knowledgeScopesVersionConflictAndIdempotentCreateAreStrict() throws Exception {
    String request = UUID.randomUUID().toString();
    var payload = write(0, "작성", "ORGANIZATION", "DOCUMENT", request);
    var d =
        response(
            mvc.perform(
                actor(post("/api/knowledge"), "alice", "a")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body(payload))));
    String id = d.path("id").asText();
    mvc.perform(
            actor(post("/api/knowledge"), "alice", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(payload)))
        .andExpect(jsonPath("$.id").value(id));
    mvc.perform(
            actor(post("/api/knowledge"), "alice", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(write(0, "작성", "SELF", "DOCUMENT", request))))
        .andExpect(status().isConflict());
    d = transition(d, "publish");
    mvc.perform(
            actor(put("/api/knowledge/" + id), "alice", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(payload)))
        .andExpect(status().isConflict());
    mvc.perform(actor(get("/api/knowledge/" + id), "eve", "b")).andExpect(status().isNotFound());
    var m = members.findById(bob).orElseThrow();
    m.assignAccess(null, Set.of(), DataScope.SELF);
    members.save(m);
    mvc.perform(actor(get("/api/knowledge"), "bob", "a"))
        .andExpect(jsonPath("$.items.length()").value(0));
    mvc.perform(actor(get("/api/knowledge/" + id), "bob", "a")).andExpect(status().isNotFound());
    m = members.findById(bob).orElseThrow();
    m.update("bob", Set.of(), true);
    members.save(m);
    mvc.perform(actor(get("/api/knowledge"), "bob", "a")).andExpect(status().isForbidden());
  }

  @Test
  void directRoomRequiresParticipationAndLeavingIsNotUndoneByPeer() throws Exception {
    var r = direct();
    String id = r.path("id").asText();
    mvc.perform(actor(get("/api/internal-chat/rooms/" + id + "/messages"), "admin", "a"))
        .andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/internal-chat/rooms/" + id + "/messages"), "eve", "b"))
        .andExpect(status().isNotFound());
    var message = send(id, "alice", UUID.randomUUID().toString(), "동료 원문");
    assertThat(message.path("own").asBoolean()).isTrue();
    var view =
        response(
            mvc.perform(actor(get("/api/internal-chat/rooms/" + id + "/messages"), "bob", "a")));
    assertThat(view.path("messages").get(0).path("own").asBoolean()).isFalse();
    mvc.perform(
            actor(post("/api/internal-chat/rooms/" + id + "/leave"), "bob", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(Map.of("expectedVersion", view.path("room").path("version").asLong()))))
        .andExpect(status().isOk());
    direct();
    mvc.perform(actor(get("/api/internal-chat/rooms/" + id + "/messages"), "bob", "a"))
        .andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/internal-chat/rooms/" + id + "/events"), "bob", "a"))
        .andExpect(status().isNotFound());
    assertThat(messages.count()).isEqualTo(1);
  }

  @Test
  void concurrentSameUuidProducesOneMessageAndReadNeverMovesBackward() throws Exception {
    String room = direct().path("id").asText(), id = UUID.randomUUID().toString();
    var pool = Executors.newFixedThreadPool(2);
    try {
      var first = pool.submit(() -> send(room, "alice", id, "원문"));
      var second = pool.submit(() -> send(room, "alice", id, "원문"));
      assertThat(first.get().path("sequence").asLong())
          .isEqualTo(second.get().path("sequence").asLong());
    } finally {
      pool.shutdownNow();
    }
    assertThat(messages.count()).isEqualTo(1);
    mvc.perform(
            actor(post("/api/internal-chat/rooms/" + room + "/messages"), "alice", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(Map.of("clientMessageId", id, "body", "변경", "attachmentIds", List.of()))))
        .andExpect(status().isConflict());
    send(room, "alice", UUID.randomUUID().toString(), "두 번째");
    for (long sequence : List.of(2L, 1L))
      mvc.perform(
              actor(post("/api/internal-chat/rooms/" + room + "/read"), "bob", "a")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body(Map.of("sequence", sequence))))
          .andExpect(jsonPath("$.unread").value(0));
    mvc.perform(
            actor(
                get("/api/internal-chat/rooms/" + room + "/messages?afterSequence=1"), "bob", "a"))
        .andExpect(jsonPath("$.messages.length()").value(1))
        .andExpect(jsonPath("$.cursor").value(2));
    var m = members.findById(bob).orElseThrow();
    m.update("bob", Set.of("internal-chat:read"), true);
    members.save(m);
    mvc.perform(
            actor(post("/api/internal-chat/rooms/" + room + "/messages"), "bob", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(
                        Map.of(
                            "clientMessageId",
                            UUID.randomUUID(),
                            "body",
                            "금지",
                            "attachmentIds",
                            List.of()))))
        .andExpect(status().isForbidden());
    m = members.findById(bob).orElseThrow();
    m.revoke();
    members.save(m);
    mvc.perform(actor(get("/api/internal-chat/rooms/" + room + "/events"), "bob", "a"))
        .andExpect(status().isForbidden());
  }

  @Test
  void groupRemovalRevokesHistoryAndForeignParticipantCannotBeInvited() throws Exception {
    var r =
        response(
            mvc.perform(
                actor(post("/api/internal-chat/rooms"), "alice", "a")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        body(
                            Map.of(
                                "requestId",
                                UUID.randomUUID(),
                                "kind",
                                "GROUP",
                                "name",
                                "검증 그룹",
                                "participantIds",
                                List.of(bob))))));
    String id = r.path("id").asText();
    mvc.perform(
            actor(put("/api/internal-chat/rooms/" + id), "bob", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(
                        Map.of(
                            "expectedVersion",
                            r.path("version").asLong(),
                            "name",
                            "탈취",
                            "add",
                            List.of(),
                            "remove",
                            List.of()))))
        .andExpect(status().isForbidden());
    mvc.perform(
            actor(put("/api/internal-chat/rooms/" + id), "alice", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(
                        Map.of(
                            "expectedVersion",
                            r.path("version").asLong(),
                            "name",
                            "검증 그룹",
                            "add",
                            List.of(outsider),
                            "remove",
                            List.of()))))
        .andExpect(status().isNotFound());
    mvc.perform(
            actor(put("/api/internal-chat/rooms/" + id), "alice", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(
                        Map.of(
                            "expectedVersion",
                            r.path("version").asLong(),
                            "name",
                            "검증 그룹",
                            "add",
                            List.of(),
                            "remove",
                            List.of(bob)))))
        .andExpect(status().isOk());
    mvc.perform(actor(get("/api/internal-chat/rooms/" + id + "/messages"), "bob", "a"))
        .andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/internal-chat/rooms"), "bob", "a"))
        .andExpect(jsonPath("$.items.length()").value(0));
    mvc.perform(actor(get("/api/internal-chat/candidates"), "alice", "a"))
        .andExpect(jsonPath("$.length()").value(3));
  }

  @Test
  void privateFilesRequireDomainAttachmentAndPublishedRevision() throws Exception {
    byte[] bytes = "fixture".getBytes(java.nio.charset.StandardCharsets.UTF_8);
    String hash =
        HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
    when(platform.uploadFile(
            any(org.springframework.web.multipart.MultipartFile.class), anyString()))
        .thenReturn(
            new PlatformClient.FileUploadResult(
                "private-id", "fixture.txt", bytes.length, hash, "", "COMPLETED"));
    when(platform.getViewTicket("private-id"))
        .thenReturn(
            Map.of(
                "originalUrl",
                "https://files.example/private-ticket",
                "shareUrl",
                "https://files.example/public"));
    var d = create("첨부 지식", "ORGANIZATION");
    String doc = d.path("id").asText(), request = UUID.randomUUID().toString();
    var upload =
        multipart("/api/knowledge/" + doc + "/files")
            .file(new MockMultipartFile("file", "fixture.txt", "text/plain", bytes))
            .param("requestId", request);
    var f = response(mvc.perform(actor(upload, "alice", "a")));
    String file = f.path("id").asText();
    d = transition(d, "publish");
    mvc.perform(actor(get("/api/knowledge/" + doc + "/files/" + file + "/views"), "bob", "a"))
        .andExpect(status().isNotFound());
    var w =
        new HashMap<>(
            write(
                d.path("version").asLong(),
                "첨부 지식",
                "ORGANIZATION",
                "DOCUMENT",
                UUID.randomUUID().toString()));
    w.put("attachmentIds", List.of(file));
    d =
        response(
            mvc.perform(
                actor(put("/api/knowledge/" + doc), "alice", "a")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body(w))));
    d = transition(d, "publish");
    mvc.perform(actor(get("/api/knowledge/" + doc + "/files/" + file + "/views"), "bob", "a"))
        .andExpect(jsonPath("$.originalUrl").exists())
        .andExpect(jsonPath("$.shareUrl").doesNotExist());
    String other = create("다른 문서", "ORGANIZATION").path("id").asText();
    mvc.perform(actor(get("/api/knowledge/" + other + "/files/" + file + "/views"), "alice", "a"))
        .andExpect(status().isNotFound());
    String room = direct().path("id").asText();
    mvc.perform(
            actor(post("/api/internal-chat/rooms/" + room + "/messages"), "alice", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(
                        Map.of(
                            "clientMessageId",
                            UUID.randomUUID(),
                            "body",
                            "금지",
                            "attachmentIds",
                            List.of(file)))))
        .andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/knowledge/" + doc + "/files/" + file + "/views"), "eve", "b"))
        .andExpect(status().isNotFound());
  }

  @Test
  void currentTeamVisibilityAndPublishOnlyReviewRoleStaySeparate() throws Exception {
    teams.save(new Team("team-a", "a", "지원팀", null));
    teams.save(new Team("team-b", "a", "영업팀", null));
    var author = members.findById(alice).orElseThrow();
    author.assignAccess("team-a", Set.of(), DataScope.ORGANIZATION);
    members.save(author);
    var reader = members.findById(bob).orElseThrow();
    reader.assignAccess("team-a", Set.of(), DataScope.ORGANIZATION);
    members.save(reader);
    var d = transition(create("팀 지식", "TEAM"), "publish");
    String path = "/api/knowledge/" + d.path("id").asText();
    mvc.perform(actor(get(path), "bob", "a")).andExpect(status().isOk());
    reader = members.findById(bob).orElseThrow();
    reader.assignAccess("team-b", Set.of(), DataScope.ORGANIZATION);
    members.save(reader);
    mvc.perform(actor(get(path), "bob", "a")).andExpect(status().isNotFound());
    var reviewer =
        members
            .findByOrganizationIdAndIssuerAndSubjectAndActiveTrue("a", ISSUER, "admin")
            .orElseThrow();
    reviewer.update("검토자", Set.of("knowledge:publish"), true);
    members.save(reviewer);
    mvc.perform(actor(get(path), "admin", "a"))
        .andExpect(jsonPath("$.editable").value(false))
        .andExpect(jsonPath("$.publishable").value(true));
    mvc.perform(actor(get(path + "/revisions"), "admin", "a"))
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].visibility").value("TEAM"));
    mvc.perform(
            actor(post("/api/knowledge"), "admin", "a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    body(write(0, "금지", "ORGANIZATION", "DOCUMENT", UUID.randomUUID().toString()))))
        .andExpect(status().isForbidden());
  }

  @Test
  void concurrentCreateUsesOneDocumentAndOneInitialRevision() throws Exception {
    var payload = write(0, "동시 작성", "ORGANIZATION", "DOCUMENT", UUID.randomUUID().toString());
    var pool = Executors.newFixedThreadPool(2);
    try {
      Callable<JsonNode> create =
          () ->
              response(
                  mvc.perform(
                      actor(post("/api/knowledge"), "alice", "a")
                          .contentType(MediaType.APPLICATION_JSON)
                          .content(body(payload))));
      var first = pool.submit(create);
      var second = pool.submit(create);
      assertThat(first.get().path("id").asText()).isEqualTo(second.get().path("id").asText());
      assertThat(documents.count()).isEqualTo(1);
      assertThat(revisions.count()).isEqualTo(1);
    } finally {
      pool.shutdownNow();
    }
  }
}
