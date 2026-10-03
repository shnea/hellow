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
import kr.shnea.hellow.consultation.*;
import kr.shnea.hellow.customer.Customer;
import kr.shnea.hellow.followup.*;
import kr.shnea.hellow.livekit.LiveKitService;
import kr.shnea.hellow.platform.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.routing.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.transfer.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:transfers;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@AutoConfigureMockMvc
class WorkTransferIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  @Autowired MockMvc mvc;@Autowired ObjectMapper json;
  @Autowired WorkTransferRepository requests;@Autowired WorkTransferEventRepository events;
  @Autowired WorkTransferService service;@Autowired ConsultationRepository records;
  @Autowired OrganizationRepository organizations;@Autowired MembershipRepository members;
  @Autowired QueueItemRepository queues;@Autowired AuditEventRepository audits;
  @Autowired AgentPresenceRepository presence;@Autowired AssignmentAttemptRepository attempts;
  @Autowired TeamRepository teams;@Autowired OrganizationRoleRepository roles;
  @Autowired ConsultationRevisionRepository revisions;
  @Autowired AttachmentRepository attachments;@Autowired FollowUpRepository followups;
  @Autowired FollowUpEventRepository followupEvents;@Autowired RoutingService routing;
  @MockitoBean JwtDecoder decoder;@MockitoBean Clock clock;
  @MockitoBean PlatformClient platform;@MockitoBean LiveKitService media;
  Instant now;
  @BeforeEach void setup(){
    events.deleteAll();requests.deleteAll();followupEvents.deleteAll();followups.deleteAll();attachments.deleteAll();revisions.deleteAll();records.deleteAll();attempts.deleteAll();presence.deleteAll();queues.deleteAll();audits.deleteAll();members.deleteAll();roles.deleteAll();teams.deleteAll();organizations.deleteAll();
    organizations.save(new Organization("a","A","a-public"));organizations.save(new Organization("b","B","b-public"));
    for(String org:List.of("a","b"))for(String who:List.of("alice","bob","carol","manager")){
      var permissions=new HashSet<>(OrganizationAdminController.PERMISSIONS);if(!who.equals("manager"))permissions.remove("organization:admin");
      var member=new Membership(org,ISSUER,who,permissions);member.assignAccess(null,Set.of(),who.equals("manager")?DataScope.ORGANIZATION:DataScope.SELF);members.save(member);
    }
    now=Instant.parse("2026-10-03T05:00:00Z");when(clock.instant()).thenAnswer(i->now);when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    when(platform.getViewTicket(anyString())).thenReturn(Map.of("url","https://files.example/test"));
  }
  WorkspaceAccess.Actor owner(String who,String org){return new WorkspaceAccess.Actor(org,who,who,ISSUER,null,DataScope.SELF,Set.of(),Map.of());}
  Consultation source(String code,QueueItem.ItemType type,boolean completed){
    if(code!=null){var q=new QueueItem(code,type,Customer.CustomerType.INDIVIDUAL,"고객",null,"01000000000",null,"normal","원래 요청",false,false,false);q.setOrganizationId("a");q.acceptBy("alice","alice");q.assignOwner(owner("alice","a"));if(completed)q.complete();queues.saveAndFlush(q);}
    var c=new Consultation(null,"원래 분류","원래 하위 분류",completed?Consultation.ConsultationStatus.COMPLETED:Consultation.ConsultationStatus.IN_PROGRESS,"원문 메모","원래 태그","원래 작성자",42);
    c.setOrganizationId("a");c.assignOwner(owner("alice","a"));c.bind(code,"alice");c.update(null,c.getCategoryMain(),c.getCategorySub(),c.getStatus(),c.getMemo(),"{\"format\":\"shnea-editor\",\"content\":{\"type\":\"doc\",\"content\":[]}}",c.getTags(),42);records.saveAndFlush(c);return records.findById(c.getId()).orElseThrow();
  }
  long member(String who,String org){return members.findByOrganizationIdAndIssuerAndSubject(org,ISSUER,who).orElseThrow().getId();}
  MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder r,String who,String org){return r.with(jwt().jwt(j->j.issuer(ISSUER).subject(who).claim("name",who))).header("X-Organization-ID",org);}
  ResultActions send(MockHttpServletRequestBuilder r,String who,String org,Object body)throws Exception{return mvc.perform(actor(r,who,org).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));}
  JsonNode ok(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
  Map<String,Object> request(Consultation c,String target){return new HashMap<>(Map.of("consultationId",c.getId(),"expectedRecordVersion",c.getVersion(),"toMemberId",member(target,"a"),"reason","담당 업무 변경","memo","대상에게 전달할 메모","requestId",UUID.randomUUID().toString()));}
  JsonNode offer(Consultation c)throws Exception{return ok(send(post("/api/transfers/work"),"alice","a",request(c,"bob")));}
  ResultActions command(JsonNode t,String who,String action,long version)throws Exception{return send(post("/api/transfers/"+t.path("id").asText()+"/"+action),who,"a",Map.of("expectedVersion",version,"reason","처리 사유"));}
  ResultActions command(JsonNode t,String who,String action)throws Exception{return command(t,who,action,t.path("version").asLong());}
  JsonNode current(String who,String org)throws Exception{return ok(mvc.perform(actor(get("/api/agents/me"),who,org)));}
  void ready(String who)throws Exception{var state=current(who,"a");ok(send(put("/api/agents/me/status"),who,"a",Map.of("state","AVAILABLE","expectedVersion",state.path("version").asLong())));}
  Consultation saved(Consultation c){return records.findById(c.getId()).orElseThrow();}
  void preserved(Consultation before,Consultation after){assertThat(after.getMemo()).isEqualTo(before.getMemo());assertThat(after.getEditorDocument()).isEqualTo(before.getEditorDocument());assertThat(after.getCategoryMain()).isEqualTo(before.getCategoryMain());assertThat(after.getCategorySub()).isEqualTo(before.getCategorySub());assertThat(after.getTags()).isEqualTo(before.getTags());assertThat(after.getAgentName()).isEqualTo(before.getAgentName());assertThat(after.getAgentSubject()).isEqualTo(before.getAgentSubject());assertThat(after.getCreatedAt()).isEqualTo(before.getCreatedAt());assertThat(after.getCallDurationSeconds()).isEqualTo(42);assertThat(after.getStatus()).isEqualTo(before.getStatus());}

  @Test void standaloneAcceptMovesResponsibilityOnlyAndRequestNeverGrantsBody()throws Exception{
    var c=source(null,QueueItem.ItemType.TICKET,true);var t=offer(c);
    assertThat(saved(c).getOwnerSubject()).isEqualTo("alice");assertThat(t.has("editorDocument")).isFalse();assertThat(t.has("requestKey")).isFalse();assertThat(t.has("requestFingerprint")).isFalse();
    var before=ok(mvc.perform(actor(get("/api/transfers/"+t.path("id").asText()),"bob","a")));assertThat(before.path("canAccept").asBoolean()).isTrue();assertThat(before.path("canReadRecord").asBoolean()).isFalse();
    command(t,"alice","accept").andExpect(status().isForbidden());command(t,"carol","accept").andExpect(status().isNotFound());
    var accepted=ok(command(t,"bob","accept"));assertThat(accepted.path("status").asText()).isEqualTo("ACCEPTED");assertThat(accepted.path("canReadRecord").asBoolean()).isTrue();
    assertThat(saved(c).getOwnerSubject()).isEqualTo("bob");assertThat(saved(c).getCurrentAssigneeName()).isEqualTo("bob");preserved(c,saved(c));
    ok(command(t,"bob","accept"));assertThat(events.count()).isEqualTo(2);assertThat(audits.findAll()).allMatch(e->!e.getDetails().contains("대상에게 전달할 메모"));
  }
  @Test void standaloneRecordReadFollowsCurrentOwnerAndAuthorityWithoutCustomerGrant()throws Exception{
    var c=source(null,QueueItem.ItemType.TICKET,true);var t=offer(c);
    mvc.perform(actor(get("/api/consultations/"+c.getId()),"bob","a")).andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/consultations/"+c.getId()),"alice","b")).andExpect(status().isNotFound());
    ok(command(t,"bob","accept"));
    var bob=members.findById(member("bob","a")).orElseThrow();bob.update("bob",Set.of("consultation:read","consultation:write","transfer:read"),true);members.save(bob);
    mvc.perform(actor(get("/api/consultations/"+c.getId()),"bob","a")).andExpect(status().isOk()).andExpect(jsonPath("$.memo").value("원문 메모")).andExpect(jsonPath("$.editable").value(true));
    mvc.perform(actor(get("/api/consultations/"+c.getId()),"alice","a")).andExpect(status().isNotFound());
    bob=members.findById(member("bob","a")).orElseThrow();bob.update("bob",Set.of("consultation:read","transfer:read"),true);members.save(bob);
    mvc.perform(actor(get("/api/consultations/"+c.getId()),"bob","a")).andExpect(status().isOk()).andExpect(jsonPath("$.editable").value(false));
    bob=members.findById(member("bob","a")).orElseThrow();bob.update("bob",Set.of("transfer:read"),true);members.save(bob);
    mvc.perform(actor(get("/api/consultations/"+c.getId()),"bob","a")).andExpect(status().isForbidden());
  }
  @Test void ongoingRecordReadRequiresEditingThroughTheQueueEvenWithoutQueueLookupGrant()throws Exception{
    var c=source("ongoing",QueueItem.ItemType.TICKET,false);
    var alice=members.findById(member("alice","a")).orElseThrow();alice.update("alice",Set.of("consultation:read","consultation:write"),true);members.save(alice);
    mvc.perform(actor(get("/api/consultations/"+c.getId()),"alice","a")).andExpect(status().isOk()).andExpect(jsonPath("$.editable").value(false)).andExpect(jsonPath("$.processing").value(true));
  }
  @Test void directionIsFilteredBeforePaginationAndNeverMatchesSubjectAlone()throws Exception{
    // A recipient has 51 incoming and one outgoing request, so post-page filtering would be incomplete.
    for(int i=0;i<51;i++)offer(source(null,QueueItem.ItemType.TICKET,true));
    var own=source(null,QueueItem.ItemType.TICKET,true);own.assignOwner(owner("bob","a"));records.saveAndFlush(own);own=saved(own);
    var sent=ok(send(post("/api/transfers/work"),"bob","a",request(own,"carol")));
    var first=ok(mvc.perform(actor(get("/api/transfers?direction=RECEIVED&status=OFFERED&page=0"),"bob","a")));
    var second=ok(mvc.perform(actor(get("/api/transfers?direction=RECEIVED&status=OFFERED&page=1"),"bob","a")));
    assertThat(first.path("items").size()).isEqualTo(50);assertThat(first.path("hasMore").asBoolean()).isTrue();
    assertThat(second.path("items").size()).isEqualTo(1);assertThat(second.path("hasMore").asBoolean()).isFalse();
    var outgoing=ok(mvc.perform(actor(get("/api/transfers?direction=SENT"),"bob","a")));
    assertThat(outgoing.path("items").size()).isEqualTo(1);assertThat(outgoing.path("items").get(0).path("id")).isEqualTo(sent.path("id"));
    String other="https://other.example/realm";var impersonator=new Membership("a",other,"bob",OrganizationAdminController.PERMISSIONS);impersonator.assignAccess(null,Set.of(),DataScope.ORGANIZATION);members.save(impersonator);
    for(String direction:List.of("SENT","RECEIVED"))mvc.perform(get("/api/transfers?direction="+direction).with(jwt().jwt(j->j.issuer(other).subject("bob"))).header("X-Organization-ID","a")).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(0));
    mvc.perform(actor(get("/api/transfers?direction=INVALID"),"bob","a")).andExpect(status().isBadRequest());
    mvc.perform(actor(get("/api/transfers?direction=RECEIVED"),"bob","b")).andExpect(jsonPath("$.items.length()").value(0));
  }
  @Test void completedQueueGetsCurrentRecordScopeAndOriginalFilesRemainBound()throws Exception{
    var c=source("done",QueueItem.ItemType.TICKET,true);var file=new Attachment("a","done","file-one","request-one","test.png","image",1L,"sha");file.assignOwner(owner("alice","a"));attachments.save(file);
    mvc.perform(actor(get("/api/editor/files/file-one/views"),"bob","a")).andExpect(status().isNotFound());
    var t=offer(c);ok(command(t,"bob","accept"));assertThat(queues.findByCode("done").orElseThrow().getOwnerSubject()).isEqualTo("alice");
    mvc.perform(actor(get("/api/consultations/queue/done"),"alice","a")).andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/consultations/queue/done"),"bob","a")).andExpect(status().isOk()).andExpect(jsonPath("$.ownerSubject").value("bob"));
    mvc.perform(actor(get("/api/editor/files/file-one/views"),"bob","a")).andExpect(status().isOk());
    var b=members.findById(member("bob","a")).orElseThrow();b.update("bob",Set.of("transfer:read"),true);members.save(b);
    mvc.perform(actor(get("/api/editor/files/file-one/views"),"bob","a")).andExpect(status().isForbidden());
    assertThat(attachments.findByOrganizationIdAndFileId("a","file-one").orElseThrow().getQueueCode()).isEqualTo("done");
  }
  @Test void dedupRecoveryAndChangedRequestAreTenantAndIdentityBound()throws Exception{
    mvc.perform(actor(get("/api/me"),"alice","a")).andExpect(status().isOk()).andExpect(jsonPath("$.issuer").value(ISSUER));
    var c=source(null,QueueItem.ItemType.TICKET,true);var body=request(c,"bob");var t=ok(send(post("/api/transfers/work"),"alice","a",body));
    var again=ok(send(post("/api/transfers/work"),"alice","a",body));assertThat(again.path("id")).isEqualTo(t.path("id"));
    String key=body.get("requestId").toString();assertThat(ok(mvc.perform(actor(get("/api/transfers/request/"+key),"alice","a"))).path("id")).isEqualTo(t.path("id"));
    mvc.perform(actor(get("/api/transfers/request/"+key),"bob","a")).andExpect(content().string(""));mvc.perform(actor(get("/api/transfers/request/"+key),"alice","b")).andExpect(content().string(""));
    body.put("memo","다른 메모");send(post("/api/transfers/work"),"alice","a",body).andExpect(status().isConflict());
    body.put("requestId","wrong");send(post("/api/transfers/work"),"alice","a",body).andExpect(status().isBadRequest());
    assertThat(requests.count()).isEqualTo(1);assertThat(events.count()).isEqualTo(1);preserved(c,saved(c));
  }
  @Test void rejectCancelAndExpiryKeepSourceAndAppendOneOutcome()throws Exception{
    var c=source(null,QueueItem.ItemType.TICKET,true);var t=offer(c);command(t,"alice","reject").andExpect(status().isForbidden());ok(command(t,"bob","reject"));ok(command(t,"bob","reject"));
    t=offer(c);command(t,"bob","cancel").andExpect(status().isForbidden());ok(command(t,"alice","cancel"));
    t=offer(c);now=now.plusSeconds(601);service.reconcile("a");var expired=ok(mvc.perform(actor(get("/api/transfers/"+t.path("id").asText()),"alice","a")));assertThat(expired.path("status").asText()).isEqualTo("EXPIRED");
    command(t,"bob","accept").andExpect(status().isConflict());assertThat(events.count()).isEqualTo(6);assertThat(saved(c).getOwnerSubject()).isEqualTo("alice");preserved(c,saved(c));
  }
  @Test void expectedRecordAndTransferVersionsRejectStaleCommands()throws Exception{
    var c=source(null,QueueItem.ItemType.TICKET,true);var body=request(c,"bob");body.put("expectedRecordVersion",99);send(post("/api/transfers/work"),"alice","a",body).andExpect(status().isConflict());
    var t=offer(c);command(t,"bob","accept",99).andExpect(status().isConflict());assertThat(events.count()).isEqualTo(1);assertThat(saved(c).getOwnerSubject()).isEqualTo("alice");
  }
  @Test void changedOriginalFailsWithoutOverwritingNewContent()throws Exception{
    var c=source(null,QueueItem.ItemType.TICKET,true);var t=offer(c);var edited=saved(c);edited.update(null,"새 분류","새 하위",edited.getStatus(),"새 문서",edited.getEditorDocument(),"새 태그",42);records.saveAndFlush(edited);
    var failed=ok(command(t,"bob","accept"));assertThat(failed.path("status").asText()).isEqualTo("FAILED");assertThat(saved(c).getOwnerSubject()).isEqualTo("alice");assertThat(saved(c).getMemo()).isEqualTo("새 문서");assertThat(events.count()).isEqualTo(2);
  }
  @Test void currentRecipientAndRequesterRevocationReconcilesWithoutHandoff()throws Exception{
    var c=source(null,QueueItem.ItemType.TICKET,true);var t=offer(c);var bob=members.findById(member("bob","a")).orElseThrow();bob.update("bob",Set.of("transfer:read"),true);members.save(bob);
    var revoked=ok(command(t,"bob","accept"));assertThat(revoked.path("status").asText()).isEqualTo("REVOKED");
    bob=members.findById(member("bob","a")).orElseThrow();bob.update("bob",OrganizationAdminController.PERMISSIONS,true);members.save(bob);t=offer(c);
    var alice=members.findById(member("alice","a")).orElseThrow();alice.revoke();members.save(alice);service.reconcile("a");
    assertThat(requests.findById(t.path("id").asText()).orElseThrow().getStatus()).isEqualTo(WorkTransfer.Status.REVOKED);assertThat(saved(c).getOwnerSubject()).isEqualTo("alice");preserved(c,saved(c));
  }
  @Test void managerCanRecoverInactiveOwnerButOrdinaryOrganizationWriterCannot()throws Exception{
    var c=source(null,QueueItem.ItemType.TICKET,true);var carol=members.findById(member("carol","a")).orElseThrow();carol.assignAccess(null,Set.of(),DataScope.ORGANIZATION);members.save(carol);
    send(post("/api/transfers/work"),"carol","a",request(c,"bob")).andExpect(status().isNotFound());
    var alice=members.findById(member("alice","a")).orElseThrow();alice.revoke();members.save(alice);
    var t=ok(send(post("/api/transfers/work"),"manager","a",request(c,"bob")));ok(command(t,"bob","accept"));assertThat(saved(c).getOwnerSubject()).isEqualTo("bob");preserved(c,saved(c));
  }
  @Test void recipientMustBeCurrentSameOrganizationAndDifferentIdentity()throws Exception{
    var c=source(null,QueueItem.ItemType.TICKET,true);var body=request(c,"bob");body.put("toMemberId",member("bob","b"));send(post("/api/transfers/work"),"alice","a",body).andExpect(status().isBadRequest());
    body.put("toMemberId",member("alice","a"));send(post("/api/transfers/work"),"alice","a",body).andExpect(status().isBadRequest());
    send(post("/api/transfers/work"),"alice","b",request(c,"bob")).andExpect(status().isNotFound());assertThat(requests.count()).isZero();
  }
  @Test void processingTicketReservesTargetAgainstAcdPickupAndOrganizationChange()throws Exception{
    var c=source("active",QueueItem.ItemType.TICKET,false);ready("bob");var t=offer(c);var state=current("bob","a");assertThat(state.path("state").asText()).isEqualTo("TRANSFER_PENDING");assertThat(state.path("workTransferId")).isEqualTo(t.path("id"));
    var other=current("bob","b");assertThat(other.path("state").asText()).isEqualTo("TRANSFER_PENDING");assertThat(other.path("workTransferId").isNull()).isTrue();
    send(put("/api/agents/me/status"),"bob","b",Map.of("state","OFFLINE","expectedVersion",state.path("version").asLong())).andExpect(status().isConflict());
    var waiting=new QueueItem("waiting",QueueItem.ItemType.TICKET,Customer.CustomerType.INDIVIDUAL,"고객",null,"01000000000",null,"normal","요청",false,false,false);waiting.setOrganizationId("a");queues.save(waiting);routing.route("a");assertThat(attempts.activeForQueue("a","waiting")).isEmpty();
    send(post("/api/queue/waiting/accept"),"bob","a",Map.of()).andExpect(status().isConflict());
    ok(command(t,"bob","accept"));assertThat(queues.findByCode("active").orElseThrow().getAssignedSubject()).isEqualTo("bob");assertThat(saved(c).getOwnerSubject()).isEqualTo("bob");assertThat(current("bob","a").path("state").asText()).isEqualTo("CALLING");preserved(c,saved(c));
  }
  @Test void pendingLiveTransferPreventsStartingScheduledFollowup()throws Exception{
    var c=source("active",QueueItem.ItemType.TICKET,false);var task=new FollowUpAction("active","CALLBACK","후속","메모");task.setOrganizationId("a");task.assignOwner(owner("bob","a"));task=followups.saveAndFlush(task);
    var scheduled=ok(send(post("/api/followup/"+task.getId()+"/schedule"),"bob","a",Map.of("expectedVersion",task.getVersion(),"scheduledAt",now.plusSeconds(5).toString(),"durationMinutes",30,"timeZone","Asia/Seoul","assignedMemberId",member("bob","a"),"reason","일정 확인")));now=now.plusSeconds(5);
    ready("bob");offer(c);send(post("/api/followup/"+task.getId()+"/status"),"bob","a",Map.of("expectedVersion",scheduled.path("version").asLong(),"status","IN_PROGRESS","reason","시작")).andExpect(status().isConflict());assertThat(followups.findById(task.getId()).orElseThrow().getStatus()).isEqualTo("SCHEDULED");
  }
  @Test void liveExpiryAndAwayReleaseReservationWithRecordedFailure()throws Exception{
    var c=source("active",QueueItem.ItemType.TICKET,false);ready("bob");var t=offer(c);now=now.plusSeconds(31);assertThat(current("bob","a").path("state").asText()).isEqualTo("TRANSFER_PENDING");service.reconcile("a");assertThat(requests.findById(t.path("id").asText()).orElseThrow().getStatus()).isEqualTo(WorkTransfer.Status.EXPIRED);assertThat(current("bob","a").path("state").asText()).isEqualTo("AVAILABLE");
    t=offer(c);var state=current("bob","a");ok(send(put("/api/agents/me/status"),"bob","a",Map.of("state","AWAY","expectedVersion",state.path("version").asLong())));service.reconcile("a");assertThat(requests.findById(t.path("id").asText()).orElseThrow().getStatus()).isEqualTo(WorkTransfer.Status.REVOKED);assertThat(current("bob","a").path("state").asText()).isEqualTo("AWAY");assertThat(saved(c).getOwnerSubject()).isEqualTo("alice");
  }
  @Test void activeVoiceRequiresActualCallTransferAndAfterCallKeepsFormerMediaCleanup()throws Exception{
    var c=source("voice",QueueItem.ItemType.CALL,false);ready("bob");send(post("/api/transfers/work"),"alice","a",request(c,"bob")).andExpect(status().isConflict());
    var q=queues.findByCode("voice").orElseThrow();q.endCall();queues.saveAndFlush(q);var t=offer(c);ok(command(t,"bob","accept"));assertThat(current("bob","a").path("state").asText()).isEqualTo("AFTER_CALL");
    var cleaner=new TransferMediaCleanupWorker(queues,requests,media,clock);doThrow(new IllegalStateException("provider offline")).doNothing().when(media).removeParticipant("a-voice","agent-alice");cleaner.cleanup();cleaner.cleanup();verify(media,times(2)).removeParticipant("a-voice","agent-alice");assertThat(saved(c).getOwnerSubject()).isEqualTo("bob");
  }
  @Test void concurrentDuplicateRequestAndAcceptCancelHaveOnePersistentOutcome()throws Exception{
    var c=source(null,QueueItem.ItemType.TICKET,true);var body=request(c,"bob");var pool=Executors.newFixedThreadPool(2);
    try{var gate=new CountDownLatch(1);var first=pool.submit(()->{gate.await();return ok(send(post("/api/transfers/work"),"alice","a",body));});var second=pool.submit(()->{gate.await();return ok(send(post("/api/transfers/work"),"alice","a",body));});gate.countDown();var t=first.get(15,TimeUnit.SECONDS);assertThat(second.get(15,TimeUnit.SECONDS).path("id")).isEqualTo(t.path("id"));assertThat(requests.count()).isEqualTo(1);
      var race=new CountDownLatch(1);var accept=pool.submit(()->{race.await();return command(t,"bob","accept").andReturn().getResponse().getStatus();});var cancel=pool.submit(()->{race.await();return command(t,"alice","cancel").andReturn().getResponse().getStatus();});race.countDown();assertThat(List.of(accept.get(15,TimeUnit.SECONDS),cancel.get(15,TimeUnit.SECONDS))).contains(200).allMatch(status->status==200||status==409||status==403);
      assertThat(events.count()).isEqualTo(2);var result=requests.findById(t.path("id").asText()).orElseThrow();assertThat(saved(c).getOwnerSubject()).isEqualTo(result.getStatus()==WorkTransfer.Status.ACCEPTED?"bob":"alice");preserved(c,saved(c));
    }finally{pool.shutdownNow();}
  }
  @Test void targetUsesCurrentRecordWritePermissionAndFormerOwnerCannotReadNewBody()throws Exception{
    var c=source("done",QueueItem.ItemType.TICKET,true);var t=offer(c);ok(command(t,"bob","accept"));
    var body=new HashMap<String,Object>();body.put("categoryMain",c.getCategoryMain());body.put("categorySub",c.getCategorySub());body.put("expectedVersion",saved(c).getVersion());body.put("memo","새 담당자가 작성한 내용");body.put("editorDocument",json.readTree(c.getEditorDocument()));body.put("tags",c.getTags());body.put("callDurationSeconds",0);body.put("complete",true);
    send(put("/api/consultations/"+c.getId()),"alice","a",body).andExpect(status().isNotFound());ok(send(put("/api/consultations/"+c.getId()),"bob","a",body));
    mvc.perform(actor(get("/api/consultations/queue/done"),"alice","a")).andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/consultations/queue/done"),"bob","a")).andExpect(jsonPath("$.memo").value("새 담당자가 작성한 내용"));
    send(put("/api/consultations/queue/done"),"alice","a",body).andExpect(status().isNotFound());assertThat(revisions.count()).isEqualTo(1);assertThat(saved(c).getAgentName()).isEqualTo("원래 작성자");assertThat(saved(c).getCallDurationSeconds()).isEqualTo(42);
  }
  @Test void identicalSubjectFromDifferentIssuerCannotReadOrActOnRecipientOffer()throws Exception{
    var c=source(null,QueueItem.ItemType.TICKET,true);var t=offer(c);String other="https://other.example/realm";var impersonator=new Membership("a",other,"bob",OrganizationAdminController.PERMISSIONS);impersonator.assignAccess(null,Set.of(),DataScope.SELF);members.save(impersonator);
    mvc.perform(get("/api/transfers/"+t.path("id").asText()).with(jwt().jwt(j->j.issuer(other).subject("bob"))).header("X-Organization-ID","a")).andExpect(status().isNotFound());
    mvc.perform(post("/api/transfers/"+t.path("id").asText()+"/accept").with(jwt().jwt(j->j.issuer(other).subject("bob"))).header("X-Organization-ID","a").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("expectedVersion",0,"reason","accept")))).andExpect(status().isNotFound());assertThat(saved(c).getOwnerSubject()).isEqualTo("alice");
  }
  @Test void teamHistoryAndRecipientRolesAreResolvedAgainAfterRoleRevocation()throws Exception{
    teams.save(new Team("root","a","상위",null));teams.save(new Team("child","a","하위","root"));teams.save(new Team("unrelated","a","대상 팀",null));teams.save(new Team("outside","a","범위 밖 팀",null));
    var alice=members.findById(member("alice","a")).orElseThrow();alice.assignAccess("child",Set.of(),DataScope.SELF);members.save(alice);
    var reader=members.findById(member("carol","a")).orElseThrow();reader.update("carol",Set.of("transfer:read"),true);reader.assignAccess("root",Set.of(),DataScope.TEAM);members.save(reader);
    var role=new OrganizationRole("recipient-role","a","대상 처리",Map.of("consultation:read",DataScope.SELF,"consultation:write",DataScope.SELF,"transfer:read",DataScope.SELF));roles.save(role);
    var bob=members.findById(member("bob","a")).orElseThrow();bob.update("bob",Set.of(),true);bob.assignAccess("unrelated",Set.of(role.getId()),DataScope.SELF);members.save(bob);
    var c=source(null,QueueItem.ItemType.TICKET,true);c.assignOwner(new WorkspaceAccess.Actor("a","alice","alice",ISSUER,"child",DataScope.SELF,Set.of(),Map.of()));records.saveAndFlush(c);c=saved(c);var t=offer(c);
    mvc.perform(actor(get("/api/transfers/"+t.path("id").asText()+"/history"),"carol","a")).andExpect(status().isOk());
    reader=members.findById(member("carol","a")).orElseThrow();reader.assignAccess("outside",Set.of(),DataScope.TEAM);members.save(reader);mvc.perform(actor(get("/api/transfers/"+t.path("id").asText()),"carol","a")).andExpect(status().isNotFound());
    role.update(role.getName(),Map.of("transfer:read",DataScope.SELF),true);roles.save(role);assertThat(ok(command(t,"bob","accept")).path("status").asText()).isEqualTo("REVOKED");assertThat(saved(c).getOwnerSubject()).isEqualTo("alice");
  }
  @Test void liveTargetCannotBeReservedForTwoSourcesAndOfflineRecipientCannotReceive()throws Exception{
    var one=source("one",QueueItem.ItemType.TICKET,false);var two=source("two",QueueItem.ItemType.TICKET,false);send(post("/api/transfers/work"),"alice","a",request(one,"bob")).andExpect(status().isConflict());
    ready("bob");var t=offer(one);send(post("/api/transfers/work"),"alice","a",request(two,"bob")).andExpect(status().isConflict());ok(command(t,"bob","reject"));offer(two);assertThat(requests.reservations(ISSUER,"bob")).hasSize(1);
  }
}
