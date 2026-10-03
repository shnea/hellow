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
import kr.shnea.hellow.customer.Customer;
import kr.shnea.hellow.followup.*;
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

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:followup;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@AutoConfigureMockMvc
class FollowUpIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired FollowUpRepository tasks;
  @Autowired FollowUpEventRepository history;@Autowired TimelineRepository timeline;
  @Autowired OrganizationRepository orgs;@Autowired MembershipRepository members;
  @Autowired TeamRepository teams;@Autowired OrganizationRoleRepository roles;
  @Autowired QueueItemRepository queues;@Autowired AuditEventRepository audits;
  @Autowired AgentPresenceRepository presence;@Autowired AssignmentAttemptRepository attempts;
  @Autowired RoutingService routing;
  @MockitoBean JwtDecoder decoder;@MockitoBean Clock clock;
  Instant now;
  @BeforeEach void setup(){
    history.deleteAll();tasks.deleteAll();timeline.deleteAll();attempts.deleteAll();presence.deleteAll();queues.deleteAll();audits.deleteAll();members.deleteAll();roles.deleteAll();teams.deleteAll();orgs.deleteAll();
    orgs.save(new Organization("a","A","a-public"));orgs.save(new Organization("b","B","b-public"));
    members.save(new Membership("a",ISSUER,"alice",OrganizationAdminController.PERMISSIONS));
    var permissions=new HashSet<>(OrganizationAdminController.PERMISSIONS);permissions.remove("organization:admin");permissions.remove("followup:assign");
    var bob=new Membership("a",ISSUER,"bob",permissions);bob.assignAccess(null,Set.of(),DataScope.SELF);members.save(bob);
    members.save(new Membership("a",ISSUER,"writer",permissions));
    members.save(new Membership("b",ISSUER,"alice",OrganizationAdminController.PERMISSIONS));
    now=Instant.parse("2026-10-03T05:00:00Z");when(clock.instant()).thenAnswer(i->now);when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    source("source","alice","a",true);
  }
  WorkspaceAccess.Actor owner(String who,String org){return new WorkspaceAccess.Actor(org,who,who,ISSUER,null,DataScope.ORGANIZATION,Set.of(),Map.of());}
  QueueItem source(String code,String who,String org,boolean completed){
    var q=new QueueItem(code,QueueItem.ItemType.TICKET,Customer.CustomerType.INDIVIDUAL,"접수 고객",null,"01000000000",null,"normal","원래 상담 요청",false,false,false);
    q.setOrganizationId(org);q.acceptBy(who,who);q.assignOwner(owner(who,org));if(completed)q.complete();return queues.saveAndFlush(q);
  }
  MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder r,String who,String org){return r.with(jwt().jwt(j->j.subject(who).issuer(ISSUER).claim("name",who))).header("X-Organization-ID",org);}
  ResultActions command(MockHttpServletRequestBuilder r,String who,String org,Object body)throws Exception{return mvc.perform(actor(r,who,org).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));}
  JsonNode ok(ResultActions r)throws Exception{return json.readTree(r.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
  Map<String,Object> request(String source){return new HashMap<>(Map.of("queueCode",source,"actionType","CALLBACK","title","재연락 요청","details","고객과 재확인할 내용","requestId",UUID.randomUUID().toString()));}
  JsonNode create(String who,String org,String source)throws Exception{return ok(command(post("/api/followup"),who,org,request(source)));}
  long member(String who,String org){return members.findByOrganizationIdAndIssuerAndSubject(org,ISSUER,who).orElseThrow().getId();}
  Map<String,Object> scheduleBody(JsonNode task,String who,String org,Instant at){return new HashMap<>(Map.of("expectedVersion",task.path("version").asLong(),"scheduledAt",at.toString(),"timeZone","Asia/Seoul","durationMinutes",30,"assignedMemberId",member(who,org),"reason","고객과 일정 확인"));}
  ResultActions schedule(String actor,String org,JsonNode task,String assignee,Instant at)throws Exception{return command(post("/api/followup/"+task.path("id").asLong()+"/schedule"),actor,org,scheduleBody(task,assignee,org,at));}
  ResultActions transition(String who,String org,JsonNode task,String state)throws Exception{return command(post("/api/followup/"+task.path("id").asLong()+"/status"),who,org,Map.of("expectedVersion",task.path("version").asLong(),"status",state,"reason","실제 처리 결과"));}
  JsonNode current(String who,String org)throws Exception{return ok(mvc.perform(actor(get("/api/agents/me"),who,org)));}
  void ready(String who)throws Exception{var current=current(who,"a");ok(command(put("/api/agents/me/status"),who,"a",Map.of("state","AVAILABLE","expectedVersion",current.path("version").asLong())));}

  Map<String,Object> publicCallBody(String channel){return Map.of("organizationCode","a-public","requestId",UUID.randomUUID().toString(),"customerName","콜백 고객","phoneNumber","01012345678","customerType","INDIVIDUAL","inquiryType","도입 문의","message","원래 작성한 문의","channel",channel);}
  JsonNode publicSubmit(Map<String,Object> body)throws Exception{return ok(mvc.perform(post("/api/support/request").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))));}
  @Test void waitingCallConvertsOnceAtDeadlineAndRecoveryDoesNotCreateAnotherCallback()throws Exception{
    var body=publicCallBody("CALL");var call=publicSubmit(body);String code=call.path("queueCode").asText();
    now=now.plusSeconds(29);routing.route("a");assertThat(tasks.count()).isZero();
    now=now.plusSeconds(1);var executor=Executors.newFixedThreadPool(2);
    try{var first=executor.submit(()->routing.route("a"));var second=executor.submit(()->routing.route("a"));first.get(10,TimeUnit.SECONDS);second.get(10,TimeUnit.SECONDS);}finally{executor.shutdownNow();}
    var task=tasks.findAll().getFirst();assertThat(tasks.count()).isOne();assertThat(history.count()).isOne();
    assertThat(task.getQueueCode()).isEqualTo(code);assertThat(task.getDetails()).isEqualTo("원래 작성한 문의");assertThat(task.getAssignedMemberId()).isNull();assertThat(task.getOwnerSubject()).isNull();
    assertThat(queues.findByCode(code).orElseThrow().getStatus()).isEqualTo(QueueItem.QueueStatus.CANCELLED);
    mvc.perform(get("/api/support/session/"+call.path("sessionId").asText())).andExpect(jsonPath("$.status").value("CALLBACK_REQUESTED"));
    assertThat(publicSubmit(body).path("status").asText()).isEqualTo("CALLBACK_REQUESTED");assertThat(tasks.count()).isOne();
    mvc.perform(post("/api/support/session/"+call.path("sessionId").asText()+"/token")).andExpect(status().isConflict());
  }
  @Test void acceptedCallWinsBeforeDeadlineAndLateAcceptanceCannotCompeteWithCallback()throws Exception{
    ready("bob");var first=publicSubmit(publicCallBody("CALL"));now=now.plusSeconds(29);
    ok(command(post("/api/queue/"+first.path("queueCode").asText()+"/accept"),"bob","a",Map.of()));
    now=now.plusSeconds(2);routing.route("a");assertThat(tasks.count()).isZero();
    var second=publicSubmit(publicCallBody("CALL"));now=now.plusSeconds(30);
    command(post("/api/queue/"+second.path("queueCode").asText()+"/accept"),"alice","a",Map.of()).andExpect(status().isConflict());
    routing.route("a");assertThat(tasks.count()).isOne();assertThat(queues.findByCode(first.path("queueCode").asText()).orElseThrow().getStatus()).isEqualTo(QueueItem.QueueStatus.PROCESSING);
  }
  @Test void cancelledCallsAndTextRequestsNeverAutomaticallyBecomeCallbacks()throws Exception{
    var cancelled=publicSubmit(publicCallBody("CALL"));publicSubmit(publicCallBody("CHAT"));
    mvc.perform(post("/api/support/session/"+cancelled.path("sessionId").asText()+"/cancel")).andExpect(status().isOk());
    now=now.plusSeconds(40);routing.route("a");assertThat(tasks.count()).isZero();
  }
  @Test void callbackAssignmentUsesPermissionScopesAndAssigneeCanProcessWithoutAppointment()throws Exception{
    publicSubmit(publicCallBody("CALL"));now=now.plusSeconds(30);routing.route("a");long id=tasks.findAll().getFirst().getId();
    mvc.perform(actor(get("/api/followup/"+id),"bob","a")).andExpect(status().isNotFound());
    var task=ok(mvc.perform(actor(get("/api/followup/"+id),"alice","a")));
    var assignment=new HashMap<String,Object>(Map.of("expectedVersion",task.path("version").asLong(),"assignedMemberId",member("bob","a"),"reason","콜백 담당 지정"));
    command(post("/api/followup/"+id+"/assign"),"writer","a",assignment).andExpect(status().isForbidden());
    command(post("/api/followup/"+id+"/assign"),"alice","b",assignment).andExpect(status().isNotFound());
    task=ok(command(post("/api/followup/"+id+"/assign"),"alice","a",assignment));
    assertThat(task.path("status").asText()).isEqualTo("ASSIGNED");assertThat(task.path("scheduledAt").isNull()).isTrue();
    mvc.perform(actor(get("/api/followup/"+id),"bob","a")).andExpect(status().isOk()).andExpect(jsonPath("$.canProcess").value(true));
    command(post("/api/followup/"+id+"/assign"),"alice","a",assignment).andExpect(status().isConflict());
    transition("alice","a",task,"IN_PROGRESS").andExpect(status().isForbidden());
    task=ok(transition("bob","a",task,"IN_PROGRESS"));task=ok(transition("bob","a",task,"FAILED"));
    task=ok(schedule("bob","a",task,"bob",now.plusSeconds(60)));transition("bob","a",task,"IN_PROGRESS").andExpect(status().isConflict());
    now=now.plusSeconds(60);task=ok(transition("bob","a",task,"IN_PROGRESS"));task=ok(transition("bob","a",task,"COMPLETED"));
    assertThat(task.path("status").asText()).isEqualTo("COMPLETED");
    var events=ok(mvc.perform(actor(get("/api/followup/"+id+"/history"),"bob","a")));assertThat(events.toString()).contains("ASSIGNED","FAILED","COMPLETED");
  }

  @Test void duplicateRequestsKeepOneTaskTimelineAndHistoryEvenAfterProposedTimePasses()throws Exception{
    var body=request("source");body.put("proposedAt",now.plusSeconds(120).toString());body.put("timeZone","Asia/Seoul");body.put("title","긴".repeat(200));
    var first=ok(command(post("/api/followup"),"alice","a",body));now=now.plusSeconds(300);
    var again=ok(command(post("/api/followup"),"alice","a",body));assertThat(again.path("id")).isEqualTo(first.path("id"));
    assertThat(tasks.count()).isEqualTo(1);assertThat(timeline.count()).isEqualTo(1);assertThat(history.count()).isEqualTo(1);
    assertThat(first.has("requestKey")).isFalse();assertThat(first.has("requestFingerprint")).isFalse();
    body.put("details","변경된 요청");command(post("/api/followup"),"alice","a",body).andExpect(status().isConflict());
    body.put("requestId","short");command(post("/api/followup"),"alice","a",body).andExpect(status().isBadRequest());
    assertThat(queues.findByCode("source").orElseThrow().getSummary()).isEqualTo("원래 상담 요청");
  }
  @Test void readonlyRequestRecoveryIsBoundToRequesterOrganizationAndCurrentReadScope()throws Exception{
    var body=request("source");String key=body.get("requestId").toString();
    mvc.perform(actor(get("/api/followup/request/"+key),"alice","a")).andExpect(status().isOk()).andExpect(content().string(""));
    var created=ok(command(post("/api/followup"),"alice","a",body));
    var recovered=ok(mvc.perform(actor(get("/api/followup/request/"+key),"alice","a")));
    assertThat(recovered.path("id")).isEqualTo(created.path("id"));assertThat(recovered.path("canWrite").asBoolean()).isTrue();assertThat(recovered.path("canAssign").asBoolean()).isTrue();assertThat(recovered.path("canProcess").asBoolean()).isTrue();
    assertThat(recovered.path("contactName").asText()).isEqualTo("접수 고객");assertThat(recovered.path("phoneNumber").asText()).isEqualTo("01000000000");assertThat(recovered.has("summary")).isFalse();
    mvc.perform(actor(get("/api/followup/request/"+key),"alice","b")).andExpect(status().isOk()).andExpect(content().string(""));
    mvc.perform(actor(get("/api/followup/request/"+key),"bob","a")).andExpect(status().isOk()).andExpect(content().string(""));
    mvc.perform(actor(get("/api/followup/request/zzzzzzzz-1234-4123-8123-abcdefabcdef"),"alice","a")).andExpect(status().isBadRequest());
    assertThat(history.count()).isEqualTo(1);assertThat(tasks.count()).isEqualTo(1);
  }
  @Test void ownActiveWorkIsVisibleWithoutQueuePermissionAndOtherOrganizationContentStaysHidden()throws Exception{
    var task=create("alice","a","source");task=ok(schedule("alice","a",task,"alice",now.plusSeconds(10)));now=now.plusSeconds(10);task=ok(transition("alice","a",task,"IN_PROGRESS"));
    var member=members.findById(member("alice","a")).orElseThrow();member.update("alice",Set.of("followup:read","followup:write"),true);members.save(member);
    var active=ok(mvc.perform(actor(get("/api/followup/active"),"alice","a")));assertThat(active.path("processing").asBoolean()).isTrue();assertThat(active.path("id")).isEqualTo(task.path("id"));
    var other=ok(mvc.perform(actor(get("/api/followup/active"),"alice","b")));assertThat(other.path("processing").asBoolean()).isTrue();assertThat(other.path("id").isNull()).isTrue();
    var caps=ok(mvc.perform(actor(get("/api/followup/"+task.path("id").asLong()),"alice","a")));assertThat(caps.path("canAssign").asBoolean()).isFalse();assertThat(caps.path("canProcess").asBoolean()).isTrue();
    task=ok(transition("alice","a",task,"COMPLETED"));assertThat(ok(mvc.perform(actor(get("/api/followup/active"),"alice","a"))).path("processing").asBoolean()).isFalse();
  }
  @Test void concurrentDuplicateCreateHasOnePersistentRequest()throws Exception{
    var body=request("source");var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
    try{var work=new ArrayList<Future<Integer>>();for(int i=0;i<2;i++)work.add(pool.submit(()->{gate.await();return command(post("/api/followup"),"alice","a",body).andReturn().getResponse().getStatus();}));gate.countDown();
      for(var result:work)assertThat(result.get(15,TimeUnit.SECONDS)).isEqualTo(200);
      assertThat(tasks.count()).isEqualTo(1);assertThat(history.count()).isEqualTo(1);assertThat(timeline.count()).isEqualTo(1);
    }finally{pool.shutdownNow();}
  }
  @Test void sourceChecksIssuerCurrentOwnerAndTenantBeforeCreation()throws Exception{
    source("active","alice","a",false);command(post("/api/followup"),"writer","a",request("active")).andExpect(status().isConflict());
    command(post("/api/followup"),"bob","a",request("active")).andExpect(status().isNotFound());
    command(post("/api/followup"),"alice","b",request("active")).andExpect(status().isNotFound());
    String other="https://other.example/realm";members.save(new Membership("a",other,"alice",OrganizationAdminController.PERMISSIONS));
    mvc.perform(post("/api/followup").with(jwt().jwt(j->j.subject("alice").issuer(other))).header("X-Organization-ID","a").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request("active")))).andExpect(status().isConflict());
    assertThat(tasks.count()).isZero();
  }
  @Test void confirmationValidatesTimeZonePastDurationVersionAndCurrentRecipient()throws Exception{
    var task=create("alice","a","source");var body=scheduleBody(task,"alice","a",now.plusSeconds(3600));
    body.put("timeZone","Not/AZone");command(post("/api/followup/"+task.path("id").asLong()+"/schedule"),"alice","a",body).andExpect(status().isBadRequest());
    body.put("timeZone","Asia/Seoul");body.put("scheduledAt",now.toString());command(post("/api/followup/"+task.path("id").asLong()+"/schedule"),"alice","a",body).andExpect(status().isBadRequest());
    body.put("scheduledAt",now.plusSeconds(3600).toString());body.put("durationMinutes",0);command(post("/api/followup/"+task.path("id").asLong()+"/schedule"),"alice","a",body).andExpect(status().isBadRequest());
    body.put("durationMinutes",30);body.put("expectedVersion",99);command(post("/api/followup/"+task.path("id").asLong()+"/schedule"),"alice","a",body).andExpect(status().isConflict());
    body.put("expectedVersion",0);body.put("assignedMemberId",member("alice","b"));command(post("/api/followup/"+task.path("id").asLong()+"/schedule"),"alice","a",body).andExpect(status().isBadRequest());
    var bob=members.findById(member("bob","a")).orElseThrow();bob.revoke();members.save(bob);schedule("alice","a",task,"bob",now.plusSeconds(3600)).andExpect(status().isBadRequest());
    assertThat(tasks.findById(task.path("id").asLong()).orElseThrow().getStatus()).isEqualTo("PENDING");assertThat(history.count()).isEqualTo(1);
  }
  @Test void assignmentNeedsSeparateAuthorityAndNeverChangesOriginalInteractionOwnership()throws Exception{
    var task=create("alice","a","source");schedule("writer","a",task,"writer",now.plusSeconds(3600)).andExpect(status().isForbidden());
    var scheduled=ok(schedule("alice","a",task,"bob",now.plusSeconds(3600)));
    assertThat(scheduled.path("status").asText()).isEqualTo("SCHEDULED");assertThat(scheduled.path("ownerSubject").asText()).isEqualTo("bob");assertThat(scheduled.path("creatorSubject").asText()).isEqualTo("alice");
    assertThat(scheduled.path("scheduledAt").asText()).isEqualTo(now.plusSeconds(3600).toString());
    assertThat(queues.findByCode("source").orElseThrow().getOwnerSubject()).isEqualTo("alice");
    assertThat(timeline.findByOrganizationIdAndQueueCodeOrderByCreatedAtDesc("a","source").getFirst().getOwnerSubject()).isEqualTo("alice");
    mvc.perform(actor(get("/api/followup/"+task.path("id").asLong()),"bob","a")).andExpect(status().isOk());
    var events=ok(mvc.perform(actor(get("/api/followup/"+task.path("id").asLong()+"/history"),"alice","a")));
    assertThat(events.get(0).path("action").asText()).isEqualTo("REASSIGNED");assertThat(events.get(0).path("beforeSnapshot").asText()).contains("고객과 재확인할 내용");
    assertThat(ok(mvc.perform(actor(get("/api/followup/assignees"),"bob","a"))).size()).isEqualTo(1);
  }
  @Test void readsHistoryAndWritesRespectScopeAndImmediateRevocation()throws Exception{
    var alice=create("alice","a","source");source("bob-source","bob","a",true);var bob=create("bob","a","bob-source");
    var list=ok(mvc.perform(actor(get("/api/followup"),"bob","a")));assertThat(list.path("items").size()).isEqualTo(1);
    mvc.perform(actor(get("/api/followup/"+alice.path("id").asLong()+"/history"),"bob","a")).andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/followup/"+bob.path("id").asLong()),"alice","b")).andExpect(status().isNotFound());
    var member=members.findById(member("bob","a")).orElseThrow();member.revoke();members.save(member);
    mvc.perform(actor(get("/api/followup"),"bob","a")).andExpect(status().isForbidden());
    transition("bob","a",bob,"CANCELLED").andExpect(status().isForbidden());
  }
  @Test void overlappingAppointmentsAcrossOrganizationsRejectButAdjacentIntervalsAreAllowed()throws Exception{
    var first=create("alice","a","source");ok(schedule("alice","a",first,"alice",now.plusSeconds(3600)));
    source("other-source","alice","b",true);var second=create("alice","b","other-source");
    schedule("alice","b",second,"alice",now.plusSeconds(4200)).andExpect(status().isConflict());
    ok(schedule("alice","b",second,"alice",now.plusSeconds(5400)));assertThat(history.count()).isEqualTo(4);
  }
  @Test void concurrentConfirmationOfDifferentTasksHasOneWinner()throws Exception{
    var first=create("alice","a","source");var second=create("alice","a","source");var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
    try{var work=new ArrayList<Future<Integer>>();for(var task:List.of(first,second))work.add(pool.submit(()->{gate.await();return schedule("alice","a",task,"alice",now.plusSeconds(3600)).andReturn().getResponse().getStatus();}));gate.countDown();
      var statuses=new ArrayList<Integer>();for(var result:work)statuses.add(result.get(15,TimeUnit.SECONDS));assertThat(statuses).containsExactlyInAnyOrder(200,409);
      assertThat(history.count()).isEqualTo(3);
    }finally{pool.shutdownNow();}
  }
  @Test void failureRetryCancellationAndTerminalRecordsKeepFullHistory()throws Exception{
    var task=ok(schedule("alice","a",create("alice","a","source"),"alice",now.plusSeconds(60)));
    transition("alice","a",task,"IN_PROGRESS").andExpect(status().isConflict());now=now.plusSeconds(61);
    task=ok(transition("alice","a",task,"IN_PROGRESS"));assertThat(current("alice","a").path("state").asText()).isEqualTo("FOLLOW_UP");
    task=ok(transition("alice","a",task,"FAILED"));assertThat(task.path("outcome").asText()).isEqualTo("실제 처리 결과");
    var retry=ok(schedule("alice","a",task,"alice",now.plusSeconds(60)));assertThat(retry.path("outcome").isNull()).isTrue();
    var cancel=ok(transition("alice","a",retry,"CANCELLED"));schedule("alice","a",cancel,"alice",now.plusSeconds(120)).andExpect(status().isConflict());
    assertThat(history.count()).isEqualTo(6);assertThat(current("alice","a").path("state").asText()).isEqualTo("OFFLINE");
  }
  @Test void activeTaskBlocksIncomingAcceptanceAndOrganizationSwitchAndPreservesAwayAfterCompletion()throws Exception{
    var task=ok(schedule("alice","a",create("alice","a","source"),"alice",now.plusSeconds(60)));ready("alice");now=now.plusSeconds(61);
    task=ok(transition("alice","a",task,"IN_PROGRESS"));ready("bob");
    var q=new QueueItem("new-call",QueueItem.ItemType.CALL,Customer.CustomerType.INDIVIDUAL,"고객",null,"01000000000",null,"normal","새 상담",true,false,false);q.setOrganizationId("a");queues.saveAndFlush(q);
    routing.route("a");assertThat(attempts.activeForQueue("a","new-call").orElseThrow().getAgentSubject()).isEqualTo("bob");
    var state=current("alice","a");assertThat(state.path("state").asText()).isEqualTo("FOLLOW_UP");assertThat(state.path("followUpId").asLong()).isEqualTo(task.path("id").asLong());
    command(put("/api/agents/me/status"),"alice","a",Map.of("state","AVAILABLE","expectedVersion",state.path("version").asLong())).andExpect(status().isConflict());
    command(put("/api/agents/me/status"),"alice","b",Map.of("state","AWAY","expectedVersion",state.path("version").asLong())).andExpect(status().isConflict());
    command(post("/api/queue/new-call/accept"),"alice","a",Map.of()).andExpect(status().isConflict());
    ok(command(put("/api/agents/me/status"),"alice","a",Map.of("state","AWAY","expectedVersion",state.path("version").asLong())));
    ok(transition("alice","a",task,"COMPLETED"));assertThat(current("alice","a").path("state").asText()).isEqualTo("AWAY");
  }
  @Test void acceptedInteractionAndAfterCallMustFinishBeforeTaskStarts()throws Exception{
    var task=ok(schedule("alice","a",create("alice","a","source"),"alice",now.plusSeconds(60)));now=now.plusSeconds(61);
    var q=new QueueItem("active-call",QueueItem.ItemType.CALL,Customer.CustomerType.INDIVIDUAL,"고객",null,"01000000000",null,"normal","통화 요청",true,false,false);
    q.setOrganizationId("a");q.acceptBy("alice","alice");q.assignOwner(owner("alice","a"));q=queues.saveAndFlush(q);
    transition("alice","a",task,"IN_PROGRESS").andExpect(status().isConflict());
    q.endCall();q=queues.saveAndFlush(q);transition("alice","a",task,"IN_PROGRESS").andExpect(status().isConflict());
    q.complete();queues.saveAndFlush(q);ok(transition("alice","a",task,"IN_PROGRESS"));
  }
  @Test void staleEditsKeepCurrentContentAndLegacyRequestsRemainUnconfirmed()throws Exception{
    var legacy=new FollowUpAction(null,"VISIT","기존 제목","박성현 14:00 날짜 미정");legacy.setOrganizationId("a");legacy.setQueueCode("source");legacy.assignOwner(owner("alice","a"));legacy=tasks.saveAndFlush(legacy);
    var task=ok(mvc.perform(actor(get("/api/followup/"+legacy.getId()),"alice","a")));assertThat(task.path("scheduledAt").isNull()).isTrue();assertThat(task.path("assignedMemberId").isNull()).isTrue();
    var body=Map.of("expectedVersion",0,"title","수정 제목","details","수정 메모","reason","내용 보완");
    ok(command(put("/api/followup/"+legacy.getId()),"alice","a",body));command(put("/api/followup/"+legacy.getId()),"alice","a",body).andExpect(status().isConflict());
    assertThat(tasks.findById(legacy.getId()).orElseThrow().getDetails()).isEqualTo("수정 메모");assertThat(history.count()).isEqualTo(1);
  }

  @Test void teamRoleReadsIncludeDescendantsAndRoleRevocationImmediatelyRemovesThem()throws Exception{
    teams.save(new Team("parent","a","상위 팀",null));teams.save(new Team("child","a","하위 팀","parent"));teams.save(new Team("other","a","다른 팀",null));
    roles.save(new OrganizationRole("team-reader","a","팀 조회",Map.of("followup:read",DataScope.TEAM)));
    var reader=new Membership("a",ISSUER,"reader",Set.of());reader.assignAccess("parent",Set.of("team-reader"),DataScope.SELF);members.save(reader);
    var alice=members.findById(member("alice","a")).orElseThrow();alice.assignAccess("child",Set.of(),DataScope.ORGANIZATION);members.save(alice);
    var task=create("alice","a","source");var list=ok(mvc.perform(actor(get("/api/followup"),"reader","a")));assertThat(list.path("items").size()).isEqualTo(1);
    assertThat(list.path("items").get(0).path("canWrite").asBoolean()).isFalse();assertThat(list.path("items").get(0).path("canAssign").asBoolean()).isFalse();assertThat(list.path("items").get(0).path("canProcess").asBoolean()).isFalse();
    command(put("/api/followup/"+task.path("id").asLong()),"reader","a",Map.of("expectedVersion",0,"title","변경","details","메모","reason","수정")).andExpect(status().isForbidden());
    var role=roles.findById("team-reader").orElseThrow();role.update(role.getName(),Map.of("followup:read",DataScope.TEAM),false);roles.save(role);
    mvc.perform(actor(get("/api/followup/"+task.path("id").asLong()+"/history"),"reader","a")).andExpect(status().isForbidden());
  }
  @Test void expiredOrRevokedRecipientCannotBeConfirmedAndReadOnlyAssigneesAreExcluded()throws Exception{
    roles.save(new OrganizationRole("worker","a","후속 업무",Map.of("followup:read",DataScope.SELF,"followup:write",DataScope.SELF)));
    var worker=new Membership("a",ISSUER,"worker",Set.of());worker.assignAccess(null,Set.of("worker"),DataScope.SELF);worker=members.save(worker);
    var task=create("alice","a","source");var body=scheduleBody(task,"alice","a",now.plusSeconds(60));body.put("assignedMemberId",worker.getId());
    var role=roles.findById("worker").orElseThrow();role.update(role.getName(),Map.of("followup:read",DataScope.SELF),true);roles.save(role);
    command(post("/api/followup/"+task.path("id").asLong()+"/schedule"),"alice","a",body).andExpect(status().isBadRequest());
    assertThat(ok(mvc.perform(actor(get("/api/followup/assignees"),"alice","a"))).toString()).doesNotContain("worker");
  }
  @Test void taskStartAndIncomingRoutingRaceCannotReserveOrAcceptTheSamePersonTogether()throws Exception{
    var task=ok(schedule("alice","a",create("alice","a","source"),"alice",now.plusSeconds(60)));ready("alice");now=now.plusSeconds(61);
    // Renew the lease before inserting an incoming queue, without triggering a new offer.
    ok(command(post("/api/agents/me/heartbeat"),"alice","a",Map.of()));
    var q=new QueueItem("race-call",QueueItem.ItemType.CALL,Customer.CustomerType.INDIVIDUAL,"고객",null,"01000000000",null,"normal","새 상담",true,false,false);q.setOrganizationId("a");queues.saveAndFlush(q);
    var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
    try{var start=pool.submit(()->{gate.await();return transition("alice","a",task,"IN_PROGRESS").andReturn().getResponse().getStatus();});
      var route=pool.submit(()->{gate.await();routing.route("a");return true;});gate.countDown();int status=start.get(15,TimeUnit.SECONDS);assertThat(route.get(15,TimeUnit.SECONDS)).isTrue();
      if(status==200){assertThat(attempts.activeForQueue("a","race-call")).isEmpty();assertThat(tasks.activeForIdentity(ISSUER,"alice")).hasSize(1);}
      else{assertThat(status).isEqualTo(409);assertThat(attempts.activeForQueue("a","race-call")).isPresent();assertThat(tasks.activeForIdentity(ISSUER,"alice")).isEmpty();}
    }finally{pool.shutdownNow();}
  }
  @Test void writeGrantDoesNotRevealExistingTaskAfterReadGrantWasRemoved()throws Exception{
    var payload=request("source");var task=ok(command(post("/api/followup"),"alice","a",payload));
    var member=members.findById(member("alice","a")).orElseThrow();var grants=new HashSet<>(member.getPermissions());grants.remove("followup:read");member.update("alice",grants,true);members.save(member);
    command(post("/api/followup"),"alice","a",payload).andExpect(status().isNotFound());
    transition("alice","a",task,"CANCELLED").andExpect(status().isNotFound());
    assertThat(tasks.findById(task.path("id").asLong()).orElseThrow().getStatus()).isEqualTo("PENDING");assertThat(history.count()).isEqualTo(1);
  }
  @Test void startingInAnotherOrganizationMovesPresenceWithoutChangingChosenAvailability()throws Exception{
    ready("alice");var state=current("alice","a");ok(command(put("/api/agents/me/status"),"alice","a",Map.of("state","AWAY","expectedVersion",state.path("version").asLong())));
    source("b-source","alice","b",true);var task=ok(schedule("alice","b",create("alice","b","b-source"),"alice",now.plusSeconds(60)));now=now.plusSeconds(61);
    task=ok(transition("alice","b",task,"IN_PROGRESS"));var busy=current("alice","b");assertThat(busy.path("activeOrganizationId").asText()).isEqualTo("b");
    ok(command(post("/api/agents/me/heartbeat"),"alice","b",Map.of()));ok(transition("alice","b",task,"COMPLETED"));assertThat(current("alice","b").path("state").asText()).isEqualTo("AWAY");
  }
}
