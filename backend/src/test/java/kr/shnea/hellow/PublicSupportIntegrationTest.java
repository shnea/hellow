package kr.shnea.hellow;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.routing.*;
import kr.shnea.hellow.support.*;
import kr.shnea.hellow.livekit.LiveKitService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest @AutoConfigureMockMvc
@org.springframework.test.context.TestPropertySource(properties="hellow.public-pending-limit=2")
class PublicSupportIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";static final Instant NOW=Instant.parse("2026-10-03T05:00:00Z");
  @Autowired MockMvc mvc;@Autowired QueueItemRepository queues;@Autowired OrganizationRepository organizations;
  @Autowired MembershipRepository members;@Autowired AssignmentAttemptRepository attempts;@Autowired AgentPresenceRepository presence;
  @Autowired SupportExpiryService expiry;@Autowired RoutingService routing;@Autowired com.fasterxml.jackson.databind.ObjectMapper json;
  @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
  @MockitoBean Clock clock;@MockitoBean JwtDecoder decoder;@MockitoBean LiveKitService media;
  final Map<String,String> requestIds=new ConcurrentHashMap<>();
  @BeforeEach void setup(){when(clock.instant()).thenReturn(NOW);when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    attempts.deleteAll();presence.deleteAll();queues.deleteAll();members.deleteAll();organizations.deleteAll();
    organizations.save(new Organization("support-a","Support A","support-public-a"));organizations.save(new Organization("support-b","Support B","support-public-b"));
    members.save(new Membership("support-a",ISSUER,"alice",OrganizationAdminController.PERMISSIONS));
  }
  String key(String alias){return requestIds.computeIfAbsent(alias,k->UUID.randomUUID().toString());}
  String body(String id,String channel,String message){return "{\"organizationCode\":\"support-public-a\",\"requestId\":\""+key(id)+"\",\"customerType\":\"INDIVIDUAL\",\"customerName\":\"Public customer\",\"phoneNumber\":\"01000000000\",\"inquiryType\":\"Support\",\"message\":\""+message+"\",\"channel\":\""+channel+"\"}";}
  com.fasterxml.jackson.databind.JsonNode submit(String id,String channel)throws Exception{return json.readTree(mvc.perform(post("/api/support/request").contentType(MediaType.APPLICATION_JSON).content(body(id,channel,"Help"))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
  String session(com.fasterxml.jackson.databind.JsonNode q){return "/api/support/session/"+q.get("sessionId").asText();}
  QueueItem queue(com.fasterxml.jackson.databind.JsonNode q){return queues.findByCode(q.get("queueCode").asText()).orElseThrow();}
  void processing(com.fasterxml.jackson.databind.JsonNode q){var row=queue(q);row.acceptBy("alice","Alice");queues.saveAndFlush(row);}

  @Test void pageLookupNeverCreatesWorkAndInactiveOrganizationsAreDenied()throws Exception{
    mvc.perform(get("/api/support/organization/support-public-a")).andExpect(status().isOk()).andExpect(jsonPath("$.branding.primaryColor").value("#4f46e5"));
    mvc.perform(get("/api/support/request/support-public-a/"+key("preview"))).andExpect(status().isNotFound());assertThat(queues.count()).isZero();
    jdbc.update("update organizations set active=false where id='support-a'");
    mvc.perform(post("/api/support/request").contentType(MediaType.APPLICATION_JSON).content(body("closed","CALL","Help"))).andExpect(status().isNotFound());
    mvc.perform(get("/api/support/organization/support-public-a")).andExpect(status().isNotFound());assertThat(queues.count()).isZero();
  }
  @Test void retriesAndReadOnlyRecoveryReuseOneSessionAndChangedBodyIsRejected()throws Exception{
    var q=submit("retry","CHAT");submit("retry","CHAT");assertThat(queues.count()).isOne();
    mvc.perform(get("/api/support/request/support-public-a/"+key("retry"))).andExpect(status().isOk()).andExpect(jsonPath("$.sessionId").value(q.get("sessionId").asText())).andExpect(jsonPath("$.expiresAt").exists()).andExpect(jsonPath("$.estimatedWaitSeconds").doesNotExist());
    mvc.perform(post("/api/support/request").contentType(MediaType.APPLICATION_JSON).content(body("retry","CHAT","Changed"))).andExpect(status().isConflict());assertThat(queue(q).getSummary()).isEqualTo("Help");
    mvc.perform(get("/api/support/request/support-public-b/"+key("retry"))).andExpect(status().isNotFound());
  }
  @Test void concurrentDuplicateSubmissionsHaveOneQueueAndSameSession()throws Exception{
    var executor=Executors.newFixedThreadPool(2);try{var first=executor.submit(()->submit("simultaneous","CHAT"));var second=executor.submit(()->submit("simultaneous","CHAT"));
      assertThat(first.get(15,TimeUnit.SECONDS).get("sessionId")).isEqualTo(second.get(15,TimeUnit.SECONDS).get("sessionId"));assertThat(queues.count()).isOne();
    }finally{executor.shutdownNow();}
  }
  @Test void waitingCancellationIsIdempotentAndFreshRequestGetsANewSession()throws Exception{
    var q=submit("first","CALL");mvc.perform(post(session(q)+"/end-call")).andExpect(status().isConflict());
    mvc.perform(post(session(q)+"/cancel")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
    mvc.perform(post(session(q)+"/cancel")).andExpect(jsonPath("$.status").value("CANCELLED"));
    mvc.perform(post(session(q)+"/token")).andExpect(status().isConflict());
    var second=submit("second","CALL");assertThat(second.get("sessionId")).isNotEqualTo(q.get("sessionId"));assertThat(queues.count()).isEqualTo(2);
  }
  @Test void acceptedTicketsCannotMintVoiceTokensOrBecomeCallEnded()throws Exception{
    var q=submit("ticket","CHAT");processing(q);
    mvc.perform(post(session(q)+"/token")).andExpect(status().isConflict());mvc.perform(post(session(q)+"/end-call")).andExpect(status().isConflict());
    mvc.perform(post(session(q)+"/cancel")).andExpect(status().isConflict());
    mvc.perform(get(session(q))).andExpect(jsonPath("$.status").value("PROCESSING")).andExpect(jsonPath("$.channel").value("CHAT"));
    assertThat(queue(q).isCallEnded()).isFalse();verifyNoInteractions(media);
  }
  @Test void cancellationAfterCallAcceptanceEndsMediaButPreservesStaffAfterCallWork()throws Exception{
    var q=submit("accepted","CALL");processing(q);
    mvc.perform(post(session(q)+"/cancel")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CALL_ENDED"));
    mvc.perform(post(session(q)+"/end-call")).andExpect(jsonPath("$.status").value("CALL_ENDED"));
    assertThat(queue(q).getStatus()).isEqualTo(QueueItem.QueueStatus.PROCESSING);assertThat(queue(q).getSummary()).isEqualTo("Help");assertThat(queue(q).getMediaCleanupUntil()).isNotNull();
    mvc.perform(post(session(q)+"/token")).andExpect(status().isConflict());
  }
  @Test void terminalCancellationReturnsServerTruthAndCannotRestartACompletedQueue()throws Exception{
    var q=submit("done","CALL");var row=queue(q);row.complete();queues.saveAndFlush(row);
    mvc.perform(post(session(q)+"/cancel")).andExpect(jsonPath("$.status").value("COMPLETED"));
    mvc.perform(get("/api/support/request/support-public-a/"+key("done"))).andExpect(jsonPath("$.status").value("COMPLETED"));
    submit("done","CALL");assertThat(queues.count()).isOne();assertThat(queue(q).getStatus()).isEqualTo(QueueItem.QueueStatus.COMPLETED);
  }
  @Test void expiredSessionAndRequestKeyCannotRestoreCancelOrMintTokens()throws Exception{
    var q=submit("expired","CALL");when(clock.instant()).thenReturn(NOW.plus(Duration.ofHours(24)));
    mvc.perform(get(session(q))).andExpect(status().isGone());mvc.perform(post(session(q)+"/token")).andExpect(status().isGone());mvc.perform(post(session(q)+"/cancel")).andExpect(status().isGone());
    mvc.perform(get("/api/support/request/support-public-a/"+key("expired"))).andExpect(status().isGone());
    mvc.perform(post("/api/support/request").contentType(MediaType.APPLICATION_JSON).content(body("expired","CALL","Help"))).andExpect(status().isGone());
    expiry.expire("support-a",q.get("queueCode").asText());assertThat(queue(q).getStatus()).isEqualTo(QueueItem.QueueStatus.CANCELLED);verifyNoInteractions(media);
  }
  @Test void expiryKeepsAcceptedTicketWorkAndEndsAcceptedCallWithoutDeletingContent()throws Exception{
    var ticket=submit("ticket-expiry","CHAT");var call=submit("call-expiry","CALL");processing(ticket);processing(call);when(clock.instant()).thenReturn(NOW.plus(Duration.ofHours(25)));
    expiry.expire("support-a",ticket.get("queueCode").asText());expiry.expire("support-a",call.get("queueCode").asText());
    assertThat(queue(ticket).getStatus()).isEqualTo(QueueItem.QueueStatus.PROCESSING);assertThat(queue(ticket).isCallEnded()).isFalse();
    assertThat(queue(call).getStatus()).isEqualTo(QueueItem.QueueStatus.PROCESSING);assertThat(queue(call).isCallEnded()).isTrue();assertThat(queue(call).getSummary()).isEqualTo("Help");
  }
  @Test void expiryCancelsOutstandingOfferAndMakesStaleAcceptanceImpossible()throws Exception{
    var q=submit("offer-expiry","CALL");var actor=new WorkspaceAccess.Actor("support-a","alice","Alice",ISSUER,null,DataScope.ORGANIZATION,Set.of(),Map.of("queue:read",DataScope.ORGANIZATION,"queue:accept",DataScope.ORGANIZATION));
    routing.change(actor,AgentPresence.Availability.AVAILABLE,0);var offer=attempts.findAll().getFirst();when(clock.instant()).thenReturn(NOW.plus(Duration.ofHours(25)));
    routing.route("support-a");assertThat(queue(q).getStatus()).isEqualTo(QueueItem.QueueStatus.CANCELLED);assertThat(attempts.findById(offer.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.CANCELLED);
    assertThatThrownBy(()->routing.accept(actor,q.get("queueCode").asText(),offer.getId())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void publicResponseAndStaffQueueDoNotExposeSubmittedContactOrSessionCapabilities()throws Exception{
    var q=submit("private","CHAT");mvc.perform(get(session(q))).andExpect(jsonPath("$.phoneNumber").doesNotExist()).andExpect(jsonPath("$.customerName").doesNotExist()).andExpect(jsonPath("$.message").doesNotExist());
    mvc.perform(get("/api/queue").header("X-Organization-ID","support-a").with(jwt().jwt(j->j.subject("alice").issuer(ISSUER))))
      .andExpect(status().isOk()).andExpect(jsonPath("$[0].sessionId").doesNotExist()).andExpect(jsonPath("$[0].requestFingerprint").doesNotExist());
    mvc.perform(get("/api/support/session/not-a-session")).andExpect(status().isNotFound());
  }
  @Test void organizationPendingLimitBlocksNewRequestsButAllowsRecoveryAndRetry()throws Exception{
    var first=submit("limit-first","CHAT");submit("limit-second","CHAT");
    mvc.perform(post("/api/support/request").contentType(MediaType.APPLICATION_JSON).content(body("over-limit","CHAT","Help"))).andExpect(status().isTooManyRequests());
    submit("limit-first","CHAT");mvc.perform(get("/api/support/request/support-public-a/"+key("limit-first"))).andExpect(status().isOk());assertThat(queues.count()).isEqualTo(2);
    mvc.perform(post(session(first)+"/cancel")).andExpect(status().isOk());submit("over-limit","CHAT");assertThat(queues.count()).isEqualTo(3);
  }
  @Test void recoveryRequiresAnOpaqueUuidAndNormalizesUuidCase()throws Exception{
    String invalid=body("weak","CHAT","Help").replace(key("weak"),"guessable-request");
    mvc.perform(post("/api/support/request").contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());
    mvc.perform(get("/api/support/request/support-public-a/guessable-request")).andExpect(status().isBadRequest());assertThat(queues.count()).isZero();
    var q=submit("case","CHAT");String upper=body("case","CHAT","Help").replace(key("case"),key("case").toUpperCase(Locale.ROOT));
    mvc.perform(post("/api/support/request").contentType(MediaType.APPLICATION_JSON).content(upper)).andExpect(status().isOk()).andExpect(jsonPath("$.sessionId").value(q.get("sessionId").asText()));assertThat(queues.count()).isOne();
  }
}
