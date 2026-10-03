package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.*;
import java.util.concurrent.*;
import kr.shnea.hellow.consultation.*;
import kr.shnea.hellow.customer.*;
import kr.shnea.hellow.followup.*;
import kr.shnea.hellow.platform.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.timeline.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class WorkspaceIntegrationTest {
  static final String ISSUER = "https://identity.example/realms/test";
  @Autowired MockMvc mvc;
  @Autowired OrganizationRepository organizations;
  @Autowired MembershipRepository members;
  @Autowired QueueItemRepository queues;
  @Autowired CustomerRepository customers;
  @Autowired ConsultationRepository consultations;
  @Autowired ConsultationRevisionRepository revisions;
  @Autowired TimelineRepository timelines;
  @Autowired FollowUpRepository followups;
  @Autowired AttachmentRepository files;
  @MockitoBean JwtDecoder decoder;
  @MockitoBean PlatformClient platform;
  @Autowired kr.shnea.hellow.routing.AgentPresenceRepository presence;
  @Autowired kr.shnea.hellow.routing.AssignmentAttemptRepository attempts;
  @Autowired com.fasterxml.jackson.databind.ObjectMapper json;

  @BeforeEach
  void setup() {
    attempts.deleteAll();presence.deleteAll();
    files.deleteAll();
    revisions.deleteAll();
    timelines.deleteAll();
    followups.deleteAll();
    consultations.deleteAll();
    queues.deleteAll();
    customers.deleteAll();
    members.deleteAll();
    organizations.deleteAll();
    organizations.save(new Organization("org-a", "A", "public-a"));
    organizations.save(new Organization("org-b", "B", "public-b"));
    for (String subject : List.of("alice", "bob"))
      members.save(
          new Membership("org-a", ISSUER, subject, OrganizationAdminController.PERMISSIONS));
    members.save(new Membership("org-b", ISSUER, "eve", OrganizationAdminController.PERMISSIONS));
    queues.save(queue("q-a", "org-a"));
    queues.save(queue("q-b", "org-b"));
  }

  QueueItem queue(String code, String org) {
    var q =
        new QueueItem(
            code,
            QueueItem.ItemType.CALL,
            Customer.CustomerType.INDIVIDUAL,
            "Test",
            null,
            "01000000000",
            "waiting",
            "normal",
            "Test request",
            true,
            false,
            false);
    q.setOrganizationId(org);
    return q;
  }

  MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder r, String subject, String org) {
    return r.with(jwt().jwt(j -> j.subject(subject).issuer(ISSUER)))
        .header("X-Organization-ID", org);
  }

  void accept(String subject, String code) throws Exception {
    ready(subject);
    mvc.perform(acceptRequest(subject,code))
        .andExpect(status().isOk());
  }
  void ready(String subject)throws Exception{
    var state=json.readTree(mvc.perform(actor(post("/api/agents/me/heartbeat"),subject,"org-a")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    if(state.path("state").asText().equals("OFFLINE"))mvc.perform(actor(put("/api/agents/me/status"),subject,"org-a").contentType(MediaType.APPLICATION_JSON).content("{\"state\":\"AVAILABLE\",\"expectedVersion\":"+state.path("version").asLong()+"}")).andExpect(status().isOk());
  }
  MockHttpServletRequestBuilder acceptRequest(String subject,String code){
    var offer=attempts.activeForQueue("org-a",code).filter(a->a.getAgentSubject().equals(subject));
    return actor(post("/api/queue/"+code+"/accept"),subject,"org-a").contentType(MediaType.APPLICATION_JSON).content(offer.map(a->"{\"attemptId\":\""+a.getId()+"\"}").orElse("{}"));
  }

  String body(long version, boolean complete) {
    return """
    {"categoryMain":"일반 상담","categorySub":"일반 문의","categoryId":"general-inquiry","resultId":"resolved","expectedVersion":%d,"memo":"saved text",
     "editorDocument":{"format":"shnea-editor","version":3,"content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"saved text","marks":[{"type":"bold"}]}]}]}},"tags":"test","callDurationSeconds":0,"complete":%s}
    """
        .formatted(version, complete);
  }

  @Test
  void rejectsAnonymousForgedCookieWrongTenantAndRevokedMember() throws Exception {
    mvc.perform(get("/api/queue").header("Cookie", "hellow_logged_in=true"))
        .andExpect(status().isUnauthorized());
    when(decoder.decode("forged")).thenThrow(new BadJwtException("bad signature"));
    mvc.perform(get("/api/queue").header("Authorization", "Bearer forged"))
        .andExpect(status().isUnauthorized());
    mvc.perform(actor(get("/api/queue"), "alice", "org-b")).andExpect(status().isForbidden());
    mvc.perform(actor(post("/api/queue/q-b/token"), "alice", "org-a"))
        .andExpect(status().isNotFound());
    var m =
        members
            .findByOrganizationIdAndIssuerAndSubjectAndActiveTrue("org-a", ISSUER, "alice")
            .orElseThrow();
    m.revoke();
    members.save(m);
    mvc.perform(actor(get("/api/queue"), "alice", "org-a")).andExpect(status().isForbidden());
  }

  @Test
  void deniesMissingPermissionAndForeignIssuer() throws Exception {
    members.save(new Membership("org-a", ISSUER, "reader", Set.of("queue:read")));
    mvc.perform(actor(post("/api/queue/q-a/accept"), "reader", "org-a"))
        .andExpect(status().isForbidden());
    mvc.perform(
            get("/api/queue")
                .with(jwt().jwt(j -> j.subject("alice").issuer("https://other.example")))
                .header("X-Organization-ID", "org-a"))
        .andExpect(status().isForbidden());
  }

  @Test
  void queueAcceptanceIsAtomicAndOwnerOnly() throws Exception {
    ready("alice");ready("bob");
    var pool = Executors.newFixedThreadPool(2);
    var start = new CountDownLatch(1);
    try {
      var results =
          List.of("alice", "bob").stream()
              .map(
                  subject ->
                      pool.submit(
                          () -> {
                            start.await();
                            return mvc.perform(
                                    acceptRequest(subject,"q-a"))
                                .andReturn()
                                .getResponse()
                                .getStatus();
                          }))
              .toList();
      start.countDown();
      var statuses = new ArrayList<Integer>();
      for (var result : results) statuses.add(result.get(15, TimeUnit.SECONDS));
      assertThat(statuses).containsExactlyInAnyOrder(200, 409);
      var q = queues.findByCode("q-a").orElseThrow();
      String other = q.getAssignedSubject().equals("alice") ? "bob" : "alice";
      mvc.perform(actor(post("/api/queue/q-a/token"), other, "org-a"))
          .andExpect(status().isConflict());
      mvc.perform(actor(post("/api/queue/q-a/end-call"), other, "org-a"))
          .andExpect(status().isConflict());
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void sameAgentCannotAcceptTwoConcurrentCalls() throws Exception {
    queues.save(queue("q-a2", "org-a"));
    accept("alice", "q-a");
    mvc.perform(actor(post("/api/queue/q-a2/accept"), "alice", "org-a"))
        .andExpect(status().isConflict());
  }

  @Test
  void agentTokenIsRoomBoundAndCannotAdministerMedia() throws Exception {
    accept("alice", "q-a");
    String body =
        mvc.perform(actor(post("/api/queue/q-a/token"), "alice", "org-a"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String token =
        new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).get("token").asText();
    var decoded = com.auth0.jwt.JWT.decode(token);
    var grants = decoded.getClaim("video").asMap();
    assertThat(grants.get("room")).isEqualTo("org-a-q-a");
    assertThat(grants).doesNotContainKey("roomAdmin");
    assertThat(
            decoded.getExpiresAtAsInstant().getEpochSecond()
                - decoded.getIssuedAtAsInstant().getEpochSecond())
        .isEqualTo(120);
  }

  @Test
  void afterCallProcessingBlocksNextCallUntilRecordIsCompleted() throws Exception {
    queues.save(queue("q-next","org-a"));
    accept("alice","q-a");
    mvc.perform(actor(post("/api/queue/q-a/end-call"),"alice","org-a")).andExpect(status().isOk());
    mvc.perform(actor(post("/api/queue/q-next/accept"),"alice","org-a")).andExpect(status().isConflict());
    mvc.perform(actor(put("/api/consultations/queue/q-a"),"alice","org-a").contentType(MediaType.APPLICATION_JSON).content(body(0,true))).andExpect(status().isOk());
    mvc.perform(actor(post("/api/queue/q-next/accept"),"alice","org-a")).andExpect(status().isOk());
  }

  @Test
  void independentCustomerRecordPreservesOriginalAndRejectsForeignOrStaleUpdates() throws Exception {
    var customer=new Customer("cust-a",Customer.CustomerType.INDIVIDUAL,true,"Customer",null,null,null,"Standard","010","",null,"",false);
    customer.setOrganizationId("org-a");customers.save(customer);
    var historical=new Consultation("cust-a","Support","Product",Consultation.ConsultationStatus.COMPLETED,"Original memo","","Original author",43);
    historical.setOrganizationId("org-a");consultations.saveAndFlush(historical);
    String path="/api/consultations/"+historical.getId();
    mvc.perform(actor(get("/api/consultations/customer/cust-a"),"alice","org-a")).andExpect(jsonPath("$[0].memo").value("Original memo"));
    mvc.perform(actor(put(path),"eve","org-b").contentType(MediaType.APPLICATION_JSON).content(body(0,true))).andExpect(status().isNotFound());
    mvc.perform(actor(put(path),"alice","org-a").contentType(MediaType.APPLICATION_JSON).content(body(0,true))).andExpect(status().isOk()).andExpect(jsonPath("$.agentName").value("Original author")).andExpect(jsonPath("$.callDurationSeconds").value(43));
    mvc.perform(actor(put(path),"bob","org-a").contentType(MediaType.APPLICATION_JSON).content(body(0,true))).andExpect(status().isConflict());
    assertThat(revisions.findAll()).hasSize(1);assertThat(revisions.findAll().getFirst().getBeforeDocument()).contains("Original memo");
    String create="{\"customerCode\":\"cust-a\",\"requestId\":\""+UUID.randomUUID()+"\"}";
    mvc.perform(actor(post("/api/consultations"),"alice","org-a").contentType(MediaType.APPLICATION_JSON).content(create)).andExpect(status().isOk());
    mvc.perform(actor(post("/api/consultations"),"alice","org-a").contentType(MediaType.APPLICATION_JSON).content(create)).andExpect(status().isOk());
    assertThat(consultations.count()).isEqualTo(2);assertThat(queues.count()).isEqualTo(2);
  }

  @Test
  void draftUpsertVersionConflictAndAtomicCompletion() throws Exception {
    accept("alice", "q-a");
    mvc.perform(
            actor(put("/api/consultations/queue/q-a"), "alice", "org-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(0, false)))
        .andExpect(status().isOk());
    assertThat(consultations.count()).isEqualTo(1);
    var draft = consultations.findAll().getFirst();
    mvc.perform(
            actor(put("/api/consultations/queue/q-a"), "alice", "org-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(draft.getVersion() + 10, false)))
        .andExpect(status().isConflict());
    assertThat(queues.findByCode("q-a").orElseThrow().getStatus())
        .isEqualTo(QueueItem.QueueStatus.PROCESSING);
    mvc.perform(
            actor(put("/api/consultations/queue/q-a"), "alice", "org-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(draft.getVersion(), true)))
        .andExpect(status().isConflict());
    mvc.perform(actor(post("/api/queue/q-a/end-call"), "alice", "org-a"))
        .andExpect(status().isOk());
    mvc.perform(
            actor(put("/api/consultations/queue/q-a"), "alice", "org-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(draft.getVersion(), true)))
        .andExpect(status().isOk());
    mvc.perform(
            actor(put("/api/consultations/queue/q-a"), "alice", "org-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(draft.getVersion(), true)))
        .andExpect(status().isOk());
    assertThat(consultations.count()).isEqualTo(1);
    assertThat(timelines.count()).isEqualTo(1);
    assertThat(consultations.findAll().getFirst().getEditorDocument()).contains("bold");
    assertThat(queues.findByCode("q-a").orElseThrow().getStatus())
        .isEqualTo(QueueItem.QueueStatus.COMPLETED);
  }

  @Test
  void customerRegistrationLinksRealCustomerAndPersistsTimeline() throws Exception {
    accept("alice", "q-a");
    String payload =
        """
        {"queueCode":"q-a","customerType":"INDIVIDUAL","name":"New customer","phoneNumber":"01000000000","tier":"Standard"}
        """;
    mvc.perform(
            actor(post("/api/customers"), "alice", "org-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
        .andExpect(status().isOk());
    var q = queues.findByCode("q-a").orElseThrow();
    assertThat(q.getCustomerCode()).startsWith("cust-").isNotEqualTo(q.getCode());
    mvc.perform(actor(get("/api/customers/" + q.getCustomerCode()), "eve", "org-b"))
        .andExpect(status().isNotFound());
    mvc.perform(
            actor(post("/api/followup"), "alice", "org-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"queueCode\":\"q-a\",\"actionType\":\"CALLBACK\",\"title\":\"Callback"
                        + " request\",\"details\":\"Tomorrow\"}"))
        .andExpect(status().isOk());
    mvc.perform(actor(get("/api/timeline/customer/" + q.getCustomerCode()), "alice", "org-a"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].customerCode").value(q.getCustomerCode()));
  }

  @Test
  void rejectsUnownedAttachmentAndDisabledTransfer() throws Exception {
    accept("alice", "q-a");
    mvc.perform(actor(get("/api/editor/files/foreign/views"), "alice", "org-a"))
        .andExpect(status().isNotFound());
    verifyNoInteractions(platform);
    mvc.perform(
            actor(put("/api/consultations/queue/q-a"), "alice", "org-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(0, false).replace("\"marks\"", "\"fileId\":\"foreign\",\"marks\"")))
        .andExpect(status().isForbidden());
    assertThat(consultations.count()).isZero();
    mvc.perform(
            actor(post("/api/followup"), "alice", "org-a")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"queueCode\":\"q-a\",\"actionType\":\"TRANSFER\",\"title\":\"Transfer\",\"details\":\"Attempt\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void publicSessionOnlyConnectsAfterAcceptanceAndCannotCompleteStaffRecord() throws Exception {
    queues.delete(queues.findByCode("q-a").orElseThrow());
    String payload =
        """
        {"organizationCode":"public-a","requestId":"browser-request-1","customerType":"INDIVIDUAL","customerName":"Public customer","phoneNumber":"01000000000","inquiryType":"Support","message":"Help please","channel":"CALL"}
        """;
    String response =
        mvc.perform(
                post("/api/support/request")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response);
    String session = node.get("sessionId").asText(), code = node.get("queueCode").asText();
    mvc.perform(
            post("/api/support/request").contentType(MediaType.APPLICATION_JSON).content(payload))
        .andExpect(jsonPath("$.sessionId").value(session));
    mvc.perform(post("/api/support/session/" + session + "/token"))
        .andExpect(status().isConflict());
    accept("alice", code);
    mvc.perform(post("/api/support/session/" + session + "/end-call")).andExpect(status().isOk());
    assertThat(queues.findByCode(code).orElseThrow().getStatus())
        .isEqualTo(QueueItem.QueueStatus.PROCESSING);
    mvc.perform(actor(get("/api/queue"), "alice", "org-a"))
        .andExpect(status().isOk())
        .andExpect(
            content()
                .string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(session))));
    mvc.perform(post("/api/support/session/" + session + "/token"))
        .andExpect(status().isConflict());
  }
}
