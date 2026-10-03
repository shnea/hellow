package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import kr.shnea.hellow.consultation.ConsultationRepository;
import kr.shnea.hellow.customer.Customer;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.routing.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.timeline.TimelineRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.util.ReflectionTestUtils;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:routing;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@AutoConfigureMockMvc
class RoutingIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired RoutingService routing;
  @Autowired AgentPresenceRepository presence;@Autowired AssignmentAttemptRepository attempts;
  @Autowired OrganizationRepository organizations;@Autowired MembershipRepository members;
  @Autowired QueueItemRepository queues;@Autowired ConsultationRepository records;@Autowired TimelineRepository timeline;
  @Autowired OrganizationRoleRepository roles;@Autowired TeamRepository teams;
  @MockitoBean JwtDecoder decoder;@MockitoBean Clock clock;
  Instant now;
  @BeforeEach void setup(){
    attempts.deleteAll();presence.deleteAll();timeline.deleteAll();records.deleteAll();queues.deleteAll();members.deleteAll();roles.deleteAll();teams.deleteAll();organizations.deleteAll();
    organizations.save(new Organization("a","A","a-public"));organizations.save(new Organization("b","B","b-public"));
    for(String who:List.of("alice","bob","carol"))members.save(new Membership("a",ISSUER,who,OrganizationAdminController.PERMISSIONS));
    members.save(new Membership("b",ISSUER,"alice",OrganizationAdminController.PERMISSIONS));
    now=Instant.parse("2026-10-03T05:00:00Z");when(clock.instant()).thenAnswer(invocation->now);when(clock.getZone()).thenReturn(ZoneOffset.UTC);
  }
  MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder r,String who,String org){return r.with(jwt().jwt(j->j.subject(who).issuer(ISSUER).claim("name",who))).header("X-Organization-ID",org);}
  JsonNode ok(ResultActions r)throws Exception{return json.readTree(r.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
  JsonNode heartbeat(String who,String org,String received)throws Exception {
    var body=new HashMap<String,Object>();body.put("receivedAttemptId",received);
    return ok(mvc.perform(actor(post("/api/agents/me/heartbeat"),who,org).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))));
  }
  JsonNode ready(String who)throws Exception{return ready(who,"a");}
  JsonNode ready(String who,String org)throws Exception{
    long revision=ok(mvc.perform(actor(get("/api/agents/me"),who,org))).path("version").asLong();
    var result=change(who,org,"AVAILABLE",revision,200);now=now.plusMillis(1);return result;
  }
  JsonNode change(String who,String org,String state,long revision,int expected)throws Exception{
    var response=mvc.perform(actor(put("/api/agents/me/status"),who,org).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("state",state,"expectedVersion",revision)))).andExpect(status().is(expected)).andReturn().getResponse();
    return json.readTree(response.getContentAsString());
  }
  QueueItem request(String code,String org){var q=new QueueItem(code,QueueItem.ItemType.CALL,Customer.CustomerType.INDIVIDUAL,"고객",null,"01000000000",null,"normal","요청",true,false,false);q.setOrganizationId(org);return queues.saveAndFlush(q);}
  AssignmentAttempt offer(String code){return attempts.activeForQueue("a",code).orElseThrow();}
  ResultActions accept(String who,String org,String code,String attempt)throws Exception {
    var body=new HashMap<String,Object>();body.put("attemptId",attempt);
    return mvc.perform(actor(post("/api/queue/"+code+"/accept"),who,org).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
  }
  void reject(String who,String code,String attempt)throws Exception{mvc.perform(actor(post("/api/queue/"+code+"/reject"),who,"a").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("attemptId",attempt)))).andExpect(status().isOk());}

  @Test void longestIdleOfferAcknowledgementAcceptanceAndAfterCallAreServerTruth()throws Exception{
    ready("alice");now=now.plusSeconds(3);ready("bob");request("first","a");routing.route("a");
    var a=offer("first");assertThat(a.getAgentSubject()).isEqualTo("alice");
    assertThat(heartbeat("alice","a",null).path("state").asText()).isEqualTo("RESERVED");
    assertThat(heartbeat("alice","a",a.getId()).path("state").asText()).isEqualTo("RINGING");
    mvc.perform(actor(get("/api/queue"),"alice","a")).andExpect(jsonPath("$[0].code").value("first")).andExpect(jsonPath("$[0].canAccept").value(true)).andExpect(jsonPath("$[0].offer.id").value(a.getId()));
    accept("bob","a","first",a.getId()).andExpect(status().isConflict());
    accept("alice","a","first","stale").andExpect(status().isConflict());
    accept("alice","a","first",a.getId()).andExpect(status().isOk());accept("alice","a","first",a.getId()).andExpect(status().isOk());
    assertThat(queues.findByCode("first").orElseThrow().getFirstAcceptedAt()).isEqualTo(now);
    assertThat(heartbeat("alice","a",null).path("state").asText()).isEqualTo("CALLING");
    mvc.perform(actor(post("/api/queue/first/end-call"),"alice","a")).andExpect(status().isOk());
    var after=heartbeat("alice","a",null);assertThat(after.path("state").asText()).isEqualTo("AFTER_CALL");
    change("alice","a","AVAILABLE",after.path("version").asLong(),409);
    request("next","a");routing.route("a");assertThat(offer("next").getAgentSubject()).isEqualTo("bob");
    accept("alice","a","next",null).andExpect(status().isConflict());
    String complete="{\"categoryMain\":\"일반 상담\",\"categorySub\":\"일반 문의\",\"categoryId\":\"general-inquiry\",\"resultId\":\"resolved\",\"expectedVersion\":0,\"memo\":\"보존\",\"editorDocument\":{\"format\":\"shnea-editor\",\"content\":{\"type\":\"doc\",\"content\":[]}},\"complete\":true}";
    mvc.perform(actor(put("/api/consultations/queue/first"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(complete)).andExpect(status().isOk());
    assertThat(heartbeat("alice","a",null).path("state").asText()).isEqualTo("AVAILABLE");
    assertThat(attempts.findById(a.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.ACCEPTED);
  }

  @Test void unavailableMicrophoneReturnsOfferButPreservesAcceptedCall()throws Exception{
    ready("alice");ready("bob");request("mic","a");routing.route("a");var first=offer("mic");
    var unavailable=ok(mvc.perform(actor(post("/api/agents/me/heartbeat"),"alice","a").contentType(MediaType.APPLICATION_JSON).content("{\"mediaReady\":false}")));
    assertThat(unavailable.path("state").asText()).isEqualTo("AWAY");
    assertThat(attempts.findById(first.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.OFFLINE);
    var next=offer("mic");assertThat(next.getAgentSubject()).isEqualTo("bob");
    accept("bob","a","mic",next.getId()).andExpect(status().isOk());
    var active=ok(mvc.perform(actor(post("/api/agents/me/heartbeat"),"bob","a").contentType(MediaType.APPLICATION_JSON).content("{\"mediaReady\":false}")));
    assertThat(active.path("state").asText()).isEqualTo("CALLING");
    assertThat(active.path("availability").asText()).isEqualTo("AWAY");
    assertThat(attempts.findById(next.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.ACCEPTED);
  }

  @Test void rejectionReassignsImmediatelyAndDuplicateRejectDoesNotAffectNewOffer()throws Exception{
    ready("alice");now=now.plusSeconds(1);ready("bob");request("q","a");routing.route("a");var a=offer("q");
    reject("alice","q",a.getId());var b=offer("q");assertThat(b.getAgentSubject()).isEqualTo("bob");
    reject("alice","q",a.getId());assertThat(offer("q").getId()).isEqualTo(b.getId());
    accept("alice","a","q",a.getId()).andExpect(status().isConflict());
    assertThat(attempts.findById(a.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.REJECTED);
  }

  @Test void missedAndRingingTimeoutAreDistinctAndPauseUnresponsiveAgent()throws Exception{
    ready("alice");now=now.plusSeconds(1);ready("bob");now=now.plusSeconds(1);ready("carol");request("q","a");routing.route("a");var a=offer("q");
    now=now.plusSeconds(30);routing.route("a");
    assertThat(attempts.findById(a.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.MISSED);
    assertThat(presence.findByIssuerAndSubject(ISSUER,"alice").orElseThrow().getAvailability()).isEqualTo(AgentPresence.Availability.AWAY);
    var b=offer("q");heartbeat("bob","a",b.getId());now=now.plusSeconds(30);
    heartbeat("carol","a",null); // Carol remains online; Bob's delivered request expires without an answer.
    assertThat(attempts.findById(b.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.TIMED_OUT);
    assertThat(offer("q").getAgentSubject()).isEqualTo("carol");
  }

  @Test void heartbeatLeaseExpiryStopsRoutingAndStateVersionRejectsOldCommands()throws Exception{
    var state=ready("alice");long version=state.path("version").asLong();
    heartbeat("alice","a",null);heartbeat("alice","a",null); // Heartbeats do not invalidate a deliberate state command.
    change("alice","a","AWAY",version,200);change("alice","a","AVAILABLE",version,409);
    ready("alice");now=now.plusSeconds(46);request("q","a");routing.route("a");
    assertThat(attempts.activeForQueue("a","q")).isEmpty();
    assertThat(ok(mvc.perform(actor(get("/api/agents/me"),"alice","a"))).path("state").asText()).isEqualTo("OFFLINE");
  }

  @Test void concurrentRoutingNeverReservesOneIdentityForTwoQueues()throws Exception{
    ready("alice");request("q1","a");request("q2","a");var executor=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
    try{var first=executor.submit(()->{start.await();routing.route("a");return true;});var second=executor.submit(()->{start.await();routing.route("a");return true;});start.countDown();first.get(15,TimeUnit.SECONDS);second.get(15,TimeUnit.SECONDS);}finally{executor.shutdownNow();}
    assertThat(attempts.activeInOrganization("a")).hasSize(1);assertThat(attempts.count()).isEqualTo(1);
    var a=offer("q1");accept("alice","a","q1",a.getId()).andExpect(status().isOk());
    accept("alice","a","q2",null).andExpect(status().isConflict());
  }

  @Test void organizationSwitchReleasesOldOfferAndNeverBypassesAcceptedWork()throws Exception{
    ready("alice");request("qa","a");request("qb","b");routing.route("a");var a=offer("qa");
    ready("alice","b");assertThat(attempts.findById(a.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.ORGANIZATION_CHANGED);
    var b=attempts.activeForQueue("b","qb").orElseThrow();
    mvc.perform(actor(post("/api/agents/me/heartbeat"),"alice","a")).andExpect(status().isConflict());
    accept("alice","b","qb",b.getId()).andExpect(status().isOk());ready("bob");
    long version=ok(mvc.perform(actor(get("/api/agents/me"),"alice","a"))).path("version").asLong();
    change("alice","a","AVAILABLE",version,409);
    assertThat(attempts.activeForQueue("a","qa").orElseThrow().getAgentSubject()).isEqualTo("bob");
  }

  @Test void revokedRoleAndInactiveOrganizationReleaseOffersWithoutGrantingAccess()throws Exception{
    var role=roles.save(new OrganizationRole("receiver","a","상담",Map.of("queue:accept",DataScope.SELF,"queue:read",DataScope.SELF)));
    var alice=members.findByOrganizationIdAndIssuerAndSubject("a",ISSUER,"alice").orElseThrow();alice.update("alice",Set.of(),true);alice.assignAccess(null,Set.of(role.getId()),DataScope.SELF);members.save(alice);
    ready("alice");ready("bob");request("q","a");routing.route("a");var offered=offer("q");
    role.update("회수",Map.of(),true);roles.save(role);routing.route("a");
    assertThat(attempts.findById(offered.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.REVOKED);
    accept("alice","a","q",offered.getId()).andExpect(status().isForbidden());
    var next=offer("q");var org=organizations.findById("a").orElseThrow();ReflectionTestUtils.setField(org,"active",false);organizations.save(org);routing.route("a");
    assertThat(attempts.findById(next.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.REVOKED);
  }

  @Test void cancelledPublicRequestReleasesOfferAndHistoryIsTenantScoped()throws Exception{
    ready("alice");var q=request("q","a");q.setSessionId("public-session");queues.save(q);routing.route("a");var a=offer("q");
    mvc.perform(post("/api/support/session/public-session/cancel")).andExpect(status().isOk());routing.route("a");
    assertThat(attempts.findById(a.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.CANCELLED);
    accept("alice","a","q",a.getId()).andExpect(status().isConflict());
    mvc.perform(actor(get("/api/queue/q/attempts"),"alice","a")).andExpect(jsonPath("$[0].outcome").value("CANCELLED"));
    mvc.perform(actor(get("/api/queue/q/attempts"),"alice","b")).andExpect(status().isNotFound());
  }

  @Test void attemptLimitKeepsRequestWaitingUntilExplicitVersionedRestart()throws Exception{
    for(int i=0;i<10;i++){String who="agent-"+i;members.save(new Membership("a",ISSUER,who,OrganizationAdminController.PERMISSIONS));ready(who);now=now.plusMillis(1);}
    request("q","a");routing.route("a");
    for(int i=0;i<10;i++){var a=offer("q");reject(a.getAgentSubject(),"q",a.getId());}
    assertThat(attempts.activeForQueue("a","q")).isEmpty();assertThat(queues.findByCode("q").orElseThrow().getStatus()).isEqualTo(QueueItem.QueueStatus.WAITING);
    mvc.perform(actor(get("/api/queue"),"alice","a")).andExpect(jsonPath("$[0].routingPaused").value(true)).andExpect(jsonPath("$[0].attemptCount").value(10));
    mvc.perform(actor(post("/api/queue/q/restart-routing"),"alice","a").contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":99}")).andExpect(status().isConflict());
    long version=queues.findByCode("q").orElseThrow().getVersion();
    mvc.perform(actor(post("/api/queue/q/restart-routing"),"alice","a").contentType(MediaType.APPLICATION_JSON).content("{\"expectedVersion\":"+version+"}")).andExpect(status().isOk());
    assertThat(offer("q").getRoutingCycle()).isEqualTo(1);assertThat(attempts.count()).isEqualTo(11);
  }

  @Test void teamScopeDoesNotOfferAnotherTeamsOwnedBacklogAndForeignAcknowledgementIsIgnored()throws Exception{
    teams.save(new Team("team-a","a","A",null));teams.save(new Team("team-b","a","B",null));
    var alice=members.findByOrganizationIdAndIssuerAndSubject("a",ISSUER,"alice").orElseThrow();alice.assignAccess("team-a",Set.of(),DataScope.TEAM);members.save(alice);
    ready("alice");var q=request("owned","a");q.assignOwner(new WorkspaceAccess.Actor("a","someone","name",ISSUER,"team-b",DataScope.ORGANIZATION,Set.of(),Map.of()));queues.save(q);routing.route("a");
    assertThat(attempts.activeForQueue("a","owned")).isEmpty();accept("alice","a","owned",null).andExpect(status().isNotFound());
    request("public","a");routing.route("a");var a=offer("public");heartbeat("bob","a",a.getId());
    assertThat(attempts.findById(a.getId()).orElseThrow().getReceivedAt()).isNull();
  }

  @Test void sameSubjectFromAnotherIssuerCannotAcceptIssueMediaTokenOrEndCall()throws Exception{
    ready("alice");request("q","a");routing.route("a");accept("alice","a","q",offer("q").getId()).andExpect(status().isOk());
    members.save(new Membership("a","https://other.example", "alice",OrganizationAdminController.PERMISSIONS));
    for(String operation:List.of("accept","token","end-call"))mvc.perform(post("/api/queue/q/"+operation).with(jwt().jwt(j->j.subject("alice").issuer("https://other.example"))).header("X-Organization-ID","a")).andExpect(status().isConflict());
    assertThat(queues.findByCode("q").orElseThrow().isCallEnded()).isFalse();
  }

  @Test void logoutImmediatelyReleasesReservationAndHeartbeatsDoNotMakeItAvailable()throws Exception{
    ready("alice");request("q","a");routing.route("a");var a=offer("q");
    mvc.perform(actor(post("/api/session/logout"),"alice","a")).andExpect(status().isOk());
    assertThat(attempts.findById(a.getId()).orElseThrow().getOutcome()).isEqualTo(AssignmentAttempt.Outcome.OFFLINE);
    assertThat(heartbeat("alice","a",null).path("state").asText()).isEqualTo("OFFLINE");
    assertThat(attempts.activeForQueue("a","q")).isEmpty();
  }
}
