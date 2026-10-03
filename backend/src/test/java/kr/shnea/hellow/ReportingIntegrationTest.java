package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.customer.Customer;
import kr.shnea.hellow.consultation.*;
import kr.shnea.hellow.followup.*;
import kr.shnea.hellow.routing.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.util.ReflectionTestUtils;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:reporting;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","spring.datasource.hikari.connection-init-sql=SET TIME ZONE 'Asia/Seoul'"})
@AutoConfigureMockMvc
class ReportingIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  static final Instant NOW=Instant.parse("2026-10-04T03:00:00Z");
  static final String RANGE="?from=2026-10-04&until=2026-10-05";
  @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JdbcTemplate jdbc;
  @Autowired OrganizationRepository orgs;@Autowired MembershipRepository members;@Autowired TeamRepository teams;
  @Autowired OrganizationRoleRepository roles;@Autowired QueueItemRepository queues;@Autowired ConsultationRepository records;
  @Autowired FollowUpRepository followups;@Autowired AgentPresenceRepository presence;@Autowired AssignmentAttemptRepository attempts;
  @Autowired RoutingService routing;
  @MockitoBean JwtDecoder decoder;@MockitoBean Clock clock;
  @BeforeEach void setup(){
    attempts.deleteAll();presence.deleteAll();followups.deleteAll();records.deleteAll();queues.deleteAll();members.deleteAll();roles.deleteAll();teams.deleteAllInBatch();orgs.deleteAll();
    orgs.save(new Organization("a","A","a-public"));orgs.save(new Organization("b","B","b-public"));
    teams.save(new Team("t","a","상담팀",null));teams.save(new Team("child","a","지원팀","t"));teams.save(new Team("other","a","영업팀",null));
    add("admin",ISSUER,"a",null,DataScope.ORGANIZATION,Set.of("report:read","agent:monitor"));
    add("alice",ISSUER,"a","t",DataScope.SELF,Set.of("report:read","agent:monitor"));
    add("bob",ISSUER,"a","child",DataScope.SELF,Set.of("report:read","agent:monitor"));
    add("lead",ISSUER,"a","t",DataScope.TEAM,Set.of("report:read","agent:monitor"));
    add("other",ISSUER,"a","other",DataScope.SELF,Set.of("report:read","agent:monitor"));
    add("alice","https://different.example","a","other",DataScope.SELF,Set.of("report:read"));
    add("admin",ISSUER,"b",null,DataScope.ORGANIZATION,Set.of("report:read","agent:monitor"));
    when(clock.instant()).thenReturn(NOW);when(clock.getZone()).thenReturn(ZoneOffset.UTC);
  }
  Membership add(String subject,String issuer,String org,String team,DataScope scope,Set<String> grants){
    var m=new Membership(org,issuer,subject,grants);m.assignAccess(team,Set.of(),scope);m.profile(subject+"-login","직원 "+subject);return members.save(m);
  }
  WorkspaceAccess.Actor owner(String subject,String issuer,String org,String team){return new WorkspaceAccess.Actor(org,subject,subject,issuer,team,DataScope.ORGANIZATION,Set.of(),Map.of());}
  QueueItem queue(String code,String subject,String issuer,String org,String team){
    var q=new QueueItem(code,QueueItem.ItemType.CALL,Customer.CustomerType.INDIVIDUAL,"기밀 고객",null,"01099999999",null,"normal","기밀 본문",true,false,false);
    ReflectionTestUtils.setField(q,"createdAt",LocalDateTime.parse("2026-10-04T09:00:00"));
    q.setOrganizationId(org);if(subject!=null)q.assignOwner(owner(subject,issuer,org,team));q=queues.saveAndFlush(q);
    jdbc.update("UPDATE queue_items SET created_at=TIMESTAMP '2026-10-04 09:00:00' WHERE id=?",q.getId());return q;
  }
  MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder r,String subject,String org){return r.with(jwt().jwt(j->j.subject(subject).issuer(ISSUER))).header("X-Organization-ID",org);}
  JsonNode read(String path,String subject,String org)throws Exception{return json.readTree(mvc.perform(actor(get(path),subject,org)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse().getContentAsString());}
  long received(String subject)throws Exception{return read("/api/reports/consultations"+RANGE,subject,"a").at("/report/queues/totals/received").asLong();}
  @Test void tenantScopeAndIssuerApplyBeforeCountsAndGroups()throws Exception{
    queue("alice","alice",ISSUER,"a","t");queue("bob","bob",ISSUER,"a","child");queue("other","other",ISSUER,"a","other");
    queue("same-subject","alice","https://different.example","a","other");queue("foreign","alice",ISSUER,"b",null);queue("unassigned",null,ISSUER,"a",null);
    assertThat(received("alice")).isEqualTo(1);assertThat(received("bob")).isEqualTo(1);assertThat(received("lead")).isEqualTo(2);assertThat(received("admin")).isEqualTo(5);
    var groups=read("/api/reports/consultations"+RANGE+"&groupBy=AGENT","lead","a").at("/report/queues/items");assertThat(groups.size()).isEqualTo(2);
    assertThat(read("/api/reports/consultations"+RANGE,"admin","b").at("/report/queues/totals/received").asInt()).isEqualTo(1);
    mvc.perform(get("/api/reports/consultations"+RANGE).with(jwt().jwt(j->j.subject("lead").issuer("https://different.example"))).header("X-Organization-ID","a")).andExpect(status().isForbidden());
  }
  @Test void manualCohortCountsTimesAndLegacyUnmeasuredAreExplicit()throws Exception{
    var connected=queue("connected","alice",ISSUER,"a","t");connected.acceptBy("alice","직원");connected.recordFirstAcceptance(Instant.parse("2026-10-04T00:00:30Z"));
    connected.requestMedia(Instant.parse("2026-10-04T00:01:00Z"));connected.observeMedia(Instant.parse("2026-10-04T00:01:00Z"),true);connected.endCall(Instant.parse("2026-10-04T00:03:00Z"));queues.save(connected);
    var legacy=queue("legacy","alice",ISSUER,"a","t");legacy.acceptBy("alice","직원");legacy.endCall(NOW);legacy.complete();queues.save(legacy);
    var automatic=queue("callback",null,ISSUER,"a",null);automatic.convertedToCallback(7L);queues.save(automatic);
    var cancelled=queue("cancelled","alice",ISSUER,"a","t");cancelled.cancel();queues.save(cancelled);
    queue("waiting","alice",ISSUER,"a","t");
    jdbc.update("UPDATE queue_items SET created_at=TIMESTAMP '2026-10-04 09:00:00'");
    var t=read("/api/reports/consultations"+RANGE,"admin","a").at("/report/queues/totals");
    assertThat(t.path("received").asInt()).isEqualTo(5);assertThat(t.path("accepted").asInt()).isEqualTo(2);assertThat(t.path("connected").asInt()).isEqualTo(1);
    assertThat(t.path("unconnected").asInt()).isEqualTo(1);assertThat(t.path("automatic_callbacks").asInt()).isEqualTo(1);
    assertThat(t.path("measured_waits").asInt()).isEqualTo(1);assertThat(t.path("unmeasured_waits").asInt()).isEqualTo(1);
    assertThat(t.path("wait_seconds").asDouble()).isEqualTo(30);assertThat(t.path("call_seconds").asDouble()).isEqualTo(120);
    assertThat(t.path("current_wait_seconds").asDouble()).isEqualTo(10800);
  }
  @Test void dateBoundariesAndExplicitZoneDoNotReinterpretLegacyDates()throws Exception{
    var before=queue("before",null,ISSUER,"a",null);jdbc.update("UPDATE queue_items SET created_at=TIMESTAMP '2026-10-03 23:59:59' WHERE id=?",before.getId());
    var start=queue("start",null,ISSUER,"a",null);jdbc.update("UPDATE queue_items SET created_at=TIMESTAMP '2026-10-04 00:00:00' WHERE id=?",start.getId());
    var end=queue("end",null,ISSUER,"a",null);jdbc.update("UPDATE queue_items SET created_at=TIMESTAMP '2026-10-05 00:00:00' WHERE id=?",end.getId());
    assertThat(received("admin")).isEqualTo(1);
    var utc=read("/api/reports/consultations"+RANGE+"&timeZone=UTC","admin","a");assertThat(utc.at("/report/queues/totals/received").asInt()).isEqualTo(1);
    assertThat(utc.path("from").asText()).isEqualTo("2026-10-04T00:00:00Z");
  }
  @Test void emptyDataAndCurrentBacklogHaveDifferentPeriodSemantics()throws Exception{
    assertThat(received("admin")).isZero();var old=queue("old",null,ISSUER,"a",null);jdbc.update("UPDATE queue_items SET created_at=TIMESTAMP '2025-01-01 00:00:00' WHERE id=?",old.getId());
    assertThat(received("admin")).isZero();assertThat(read("/api/monitoring/summary","admin","a").path("queues").size()).isEqualTo(1);
    assertThat(read("/api/monitoring/summary","alice","a").path("queues").size()).isZero();
  }
  @Test void reportAndMonitorNeverGrantOriginalContentAndRevocationTakesEffect()throws Exception{
    queue("secret","alice",ISSUER,"a","t");String body=read("/api/reports/consultations"+RANGE,"alice","a").toString();
    assertThat(body).doesNotContain("기밀","01099999999","secret","owner_subject","issuer");
    mvc.perform(actor(get("/api/queue"),"alice","a")).andExpect(status().isForbidden());mvc.perform(actor(get("/api/consultations"),"alice","a")).andExpect(status().isForbidden());
    var m=members.findByOrganizationIdAndIssuerAndSubject("a",ISSUER,"alice").orElseThrow();m.update("직원",Set.of("agent:monitor"),true);m=members.save(m);
    mvc.perform(actor(get("/api/reports/consultations"+RANGE),"alice","a")).andExpect(status().isForbidden());
    String states=read("/api/monitoring/agents","alice","a").toString();assertThat(states).doesNotContain("기밀","secret","issuer","queueCode","subject");assertThat(json.readTree(states).path("items").size()).isEqualTo(1);
    m.revoke();members.save(m);mvc.perform(actor(get("/api/monitoring/agents"),"alice","a")).andExpect(status().isForbidden());
  }
  @Test void optionsMemberAndTeamFiltersDoNotWidenScope()throws Exception{
    queue("a","alice",ISSUER,"a","t");queue("b","bob",ISSUER,"a","child");
    long bob=members.findByOrganizationIdAndIssuerAndSubject("a",ISSUER,"bob").orElseThrow().getId();
    assertThat(read("/api/reports/consultations"+RANGE+"&memberId="+bob,"alice","a").at("/report/queues/totals/received").asInt()).isZero();
    assertThat(read("/api/reports/consultations"+RANGE+"&teamId=child","lead","a").at("/report/queues/totals/received").asInt()).isEqualTo(1);
    assertThat(read("/api/reports/options","alice","a").path("members").size()).isEqualTo(1);
    assertThat(read("/api/monitoring/agents","lead","a").path("items").size()).isEqualTo(3);
  }
  @Test void groupingPaginationAndInvalidInputAreBounded()throws Exception{
    queue("a","alice",ISSUER,"a","t");queue("b","bob",ISSUER,"a","child");
    var first=read("/api/reports/consultations"+RANGE+"&groupBy=TEAM&size=1","admin","a").at("/report/queues");assertThat(first.path("items").size()).isEqualTo(1);assertThat(first.path("hasMore").asBoolean()).isTrue();assertThat(first.at("/totals/received").asInt()).isEqualTo(2);
    var paged=read("/api/reports/consultations"+RANGE+"&groupBy=TEAM&size=1&page=1","admin","a");
    assertThat(paged.at("/report/trends/totals/received").asInt()).isEqualTo(2);assertThat(paged.at("/report/trends/items").size()).isEqualTo(1);
    assertThat(paged.at("/report/channels/items/0/received").asInt()).isEqualTo(2);
    for(String query:List.of("&size=101","&groupBy=SQL","&timeZone=no-such-zone"))mvc.perform(actor(get("/api/reports/consultations"+RANGE+query),"admin","a")).andExpect(status().isBadRequest());
    mvc.perform(actor(get("/api/reports/consultations?from=2026-10-04&until=2027-11-01"),"admin","a")).andExpect(status().isBadRequest());
  }
  @Test void ongoingAndEndedUnmeasuredCallsAreNotTheSame()throws Exception{
    var ongoing=queue("ongoing","alice",ISSUER,"a","t");ongoing.acceptBy("alice","직원");ongoing.requestMedia(NOW.minusSeconds(60));ongoing.observeMedia(NOW.minusSeconds(60),true);queues.save(ongoing);
    var unknown=queue("unknown","alice",ISSUER,"a","t");unknown.acceptBy("alice","직원");unknown.requestMedia(NOW.minusSeconds(180));unknown.observeMedia(NOW.minusSeconds(180),true);unknown.endCall(NOW);queues.save(unknown);
    jdbc.update("UPDATE queue_items SET created_at=TIMESTAMP '2026-10-04 09:00:00'");jdbc.update("UPDATE queue_items SET call_ended_at=NULL WHERE code='unknown'");
    var t=read("/api/reports/consultations"+RANGE,"admin","a").at("/report/queues/totals");
    assertThat(t.path("connected").asInt()).isEqualTo(2);assertThat(t.path("ongoing_calls").asInt()).isEqualTo(1);assertThat(t.path("measured_calls").asInt()).isEqualTo(1);assertThat(t.path("unmeasured_calls").asInt()).isEqualTo(1);assertThat(t.path("call_seconds").asInt()).isEqualTo(60);
  }
  @Test void classificationChannelCallbackAndReassignmentKeepSourceCounts()throws Exception{
    var q=queue("classified","alice",ISSUER,"a","t");q.acceptBy("alice","직원");q.recordFirstAcceptance(NOW.minusSeconds(30));queues.save(q);
    var c=new Consultation(null,"일반","문의",Consultation.ConsultationStatus.COMPLETED,"기밀 문서","","직원",120);c.setOrganizationId("a");c.bind(q.getCode(),"alice");c.assignOwner(owner("alice",ISSUER,"a","t"));c=records.saveAndFlush(c);
    jdbc.update("UPDATE consultations SET created_at=TIMESTAMP '2026-10-04 10:00:00', category_id='c',category_path='[\"일반\",\"문의\"]',result_id='r',result_name='해결' WHERE id=?",c.getId());
    var f=new FollowUpAction(null,"CALLBACK","후속","기밀 후속 본문");f.setOrganizationId("a");f.setQueueCode(q.getCode());f.assignOwner(owner("alice",ISSUER,"a","t"));f=followups.saveAndFlush(f);
    jdbc.update("UPDATE follow_up_actions SET created_at=TIMESTAMP '2026-10-04 10:00:00' WHERE id=?",f.getId());
    jdbc.update("UPDATE queue_items SET created_at=TIMESTAMP '2026-10-04 09:00:00' WHERE id=?",q.getId());
    var filtered=read("/api/reports/consultations"+RANGE+"&categoryId=c&resultId=r&channel=CALL&groupBy=CATEGORY","alice","a");assertThat(filtered.at("/report/queues/totals/received").asInt()).isEqualTo(1);assertThat(filtered.at("/report/records/totals/records").asInt()).isEqualTo(1);
    assertThat(read("/api/reports/followups"+RANGE+"&categoryId=c&resultId=r&channel=CALL","alice","a").at("/report/totals/callbacks").asInt()).isEqualTo(1);
    // Reassignment changes current ownership, not the acceptance clock or number of sources.
    var before=q.getFirstAcceptedAt();q=queues.findByCode(q.getCode()).orElseThrow();q.handoff(owner("bob",ISSUER,"a","child"));queues.save(q);assertThat(queues.findByCode(q.getCode()).orElseThrow().getFirstAcceptedAt()).isEqualTo(before);
    jdbc.update("UPDATE queue_items SET created_at=TIMESTAMP '2026-10-04 09:00:00' WHERE id=?",q.getId());
    assertThat(received("alice")).isZero();assertThat(received("bob")).isEqualTo(1);assertThat(received("admin")).isEqualTo(1);
    assertThat(read("/api/reports/consultations"+RANGE+"&categoryId=c","bob","a").at("/report/queues/totals/received").asInt()).isZero();
    jdbc.update("UPDATE follow_up_actions SET status='FAILED',version=version+1 WHERE id=?",f.getId());
    assertThat(read("/api/reports/followups"+RANGE,"alice","a").at("/report/totals/failed").asInt()).isEqualTo(1);
    jdbc.update("UPDATE follow_up_actions SET status='PENDING',version=version+1 WHERE id=?",f.getId());
    var retry=read("/api/reports/followups"+RANGE,"alice","a").at("/report/totals");assertThat(retry.path("callbacks").asInt()).isEqualTo(1);assertThat(retry.path("failed").asInt()).isZero();
  }
}
