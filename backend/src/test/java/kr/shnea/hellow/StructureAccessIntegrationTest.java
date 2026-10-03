package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.customer.*;
import kr.shnea.hellow.consultation.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.timeline.*;
import kr.shnea.hellow.platform.*;
import kr.shnea.hellow.livekit.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:structure;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
  "hellow.platform-admin-issuer=https://identity.example/realms/test","hellow.platform-admin-subject=root"})
@AutoConfigureMockMvc
class StructureAccessIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  @Autowired MockMvc mvc; @Autowired ObjectMapper json;
  @Autowired OrganizationRepository organizations;@Autowired MembershipRepository members;
  @Autowired OrganizationRoleRepository roles;@Autowired TeamRepository teams;@Autowired MembershipAccess authority;
  @Autowired CustomerRepository customers;@Autowired ConsultationRepository records;@Autowired ConsultationRevisionRepository revisions;
  @Autowired QueueItemRepository queues;@Autowired TimelineRepository timelines;@Autowired AttachmentRepository files;
  @Autowired AuditEventRepository audits;@Autowired PlatformProperties properties;
  @Autowired kr.shnea.hellow.transfer.WorkTransferRepository transfers;
  @MockitoBean JwtDecoder decoder;@MockitoBean PlatformClient platform;@MockitoBean LiveKitService media;
  Consultation aliceRecord,bobRecord,otherRecord;
  @Autowired kr.shnea.hellow.routing.AgentPresenceRepository presence;
  @Autowired kr.shnea.hellow.routing.AssignmentAttemptRepository attempts;
  @BeforeEach void setup() {
    attempts.deleteAll();presence.deleteAll();
    files.deleteAll();revisions.deleteAll();timelines.deleteAll();records.deleteAll();queues.deleteAll();customers.deleteAll();
    audits.deleteAll();members.deleteAll();roles.deleteAll();teams.deleteAll();organizations.deleteAll();
    organizations.save(new Organization("a","A","public-a"));organizations.save(new Organization("b","B","public-b"));
    teams.save(new Team("root-team","a","상담팀",null));teams.save(new Team("child-team","a","기술팀","root-team"));teams.save(new Team("other-team","a","영업팀",null));
    teams.save(new Team("foreign-team","b","다른 조직",null));
    roles.save(new OrganizationRole("self","a","상담사",grants(DataScope.SELF)));
    roles.save(new OrganizationRole("lead","a","팀장",grants(DataScope.TEAM)));
    roles.save(new OrganizationRole("foreign-role","b","다른 조직 역할",grants(DataScope.ORGANIZATION)));
    add("alice","root-team","self");add("bob","child-team","self");add("lead","root-team","lead");add("other","other-team","lead");
    members.save(new Membership("a",ISSUER,"admin",OrganizationAdminController.PERMISSIONS));
    var c=customer("customer-a","a");c.assignOwner(owner("alice","root-team"));customers.save(c);
    var outside=customer("customer-other","a");outside.assignOwner(owner("other","other-team"));customers.save(outside);
    customers.save(customer("legacy","a"));customers.save(customer("foreign","b"));
    aliceRecord=record("customer-a","alice","root-team");bobRecord=record("customer-a","bob","child-team");otherRecord=record("customer-other","other","other-team");
    var legacy=new Consultation("legacy","과거","미확인",Consultation.ConsultationStatus.COMPLETED,"legacy","","unknown",1);legacy.setOrganizationId("a");records.save(legacy);
    for(var r:List.of(aliceRecord,bobRecord,otherRecord)){
      var t=new TimelineItem(r.getCustomerCode(),TimelineItem.ChannelType.TICKET,r.getAgentName(),r.getAgentName(),"private",false,null,"");t.setOrganizationId("a");t.copyOwner(r);timelines.save(t);
    }
    var file=new Attachment("a","record-"+bobRecord.getId(),"bob-file","request","private.png","image",1,"hash");files.save(file);
    when(platform.getViewTicket("bob-file")).thenReturn(Map.of("kind","image"));
  }
  Map<String,DataScope> grants(DataScope scope){var result=new HashMap<String,DataScope>();for(String p:OrganizationAdminController.PERMISSIONS)if(!p.equals("organization:admin"))result.put(p,scope);return result;}
  void add(String subject,String team,String role){var m=new Membership("a",ISSUER,subject,Set.of());m.assignAccess(team,Set.of(role),DataScope.SELF);members.save(m);}
  WorkspaceAccess.Actor owner(String subject,String team){return new WorkspaceAccess.Actor("a",subject,subject,ISSUER,team,DataScope.ORGANIZATION,Set.of(),Map.of());}
  Customer customer(String code,String org){var c=new Customer(code,Customer.CustomerType.INDIVIDUAL,true,code,null,null,null,"Standard","010",null,null,null,false);c.setOrganizationId(org);return c;}
  Consultation record(String customer,String subject,String team){var r=new Consultation(customer,"일반","문의",Consultation.ConsultationStatus.COMPLETED,subject,"",subject,1);r.setOrganizationId("a");r.bind(null,subject);r.assignOwner(owner(subject,team));return records.save(r);}
  MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder r,String subject,String org){return r.with(jwt().jwt(j->j.subject(subject).issuer(ISSUER))).header("X-Organization-ID",org);}
  JsonNode getJson(String path,String subject) throws Exception{return json.readTree(mvc.perform(actor(get(path),subject,"a")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
  JsonNode putJson(String path,String subject,Object body,int expected) throws Exception {
    var response=mvc.perform(actor(put(path),subject,"a").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().is(expected)).andReturn().getResponse();
    return response.getContentAsString().isEmpty()?json.nullNode():json.readTree(response.getContentAsString());
  }
  Membership member(String subject){return members.findByOrganizationIdAndIssuerAndSubject("a",ISSUER,subject).orElseThrow();}
  Map<String,Object> assignment(String subject,String team,Set<String> roleIds,Set<String> direct,DataScope scope) {
    var r=new HashMap<String,Object>();r.put("expectedVersion",member(subject).getVersion());r.put("teamId",team);r.put("roleIds",roleIds);r.put("permissions",direct);r.put("dataScope",scope);return r;
  }
  Map<String,Object> save(long version){return Map.of("categoryMain","일반 상담","categorySub","일반 문의","categoryId","general-inquiry","resultId","resolved","expectedVersion",version,"memo","updated","editorDocument",Map.of("format","shnea-editor","content",Map.of("type","doc","content",List.of())),"tags","","complete",true);}
  @Test void selfTeamAndOrganizationFilterCustomerRecordsAndTimelineInSql() throws Exception {
    assertThat(getJson("/api/customers","alice").size()).isEqualTo(1);
    assertThat(getJson("/api/consultations/customer/customer-a","alice").get(0).get("agentSubject").asText()).isEqualTo("alice");
    assertThat(getJson("/api/consultations/customer/customer-a","alice").size()).isEqualTo(1);
    assertThat(getJson("/api/consultations/customer/customer-a","lead").size()).isEqualTo(2);
    assertThat(getJson("/api/timeline/customer/customer-a","alice").size()).isEqualTo(1);
    assertThat(getJson("/api/timeline/customer/customer-a","lead").size()).isEqualTo(2);
    assertThat(getJson("/api/customers","admin").size()).isEqualTo(3);
    mvc.perform(actor(get("/api/consultations/customer/legacy"),"alice","a")).andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/consultations/customer/customer-a"),"other","a")).andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/customers/foreign"),"admin","a")).andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/customers"),"root","a")).andExpect(status().isForbidden());
  }
  @Test void roleAssignmentAndScopeChangesApplyWithoutNewTokenAndKeepOwnershipSnapshot() throws Exception {
    var lead=member("lead");
    putJson("/api/admin/memberships/"+lead.getId()+"/access","admin",assignment("lead","other-team",Set.of("lead"),Set.of(),DataScope.SELF),200);
    mvc.perform(actor(get("/api/consultations/customer/customer-a"),"lead","a")).andExpect(status().isNotFound());
    var alice=member("alice");
    putJson("/api/admin/memberships/"+alice.getId()+"/access","admin",assignment("alice","other-team",Set.of("self"),Set.of(),DataScope.SELF),200);
    assertThat(records.findById(aliceRecord.getId()).orElseThrow().getTeamId()).isEqualTo("root-team");
    assertThat(getJson("/api/consultations/customer/customer-a","alice").size()).isEqualTo(1);
    var role=roles.findById("self").orElseThrow();var reduced=new HashMap<>(role.getGrants());reduced.remove("consultation:read");
    putJson("/api/admin/roles/self","admin",Map.of("name",role.getName(),"grants",reduced,"active",true,"expectedVersion",role.getVersion()),200);
    mvc.perform(actor(get("/api/consultations/customer/customer-a"),"alice","a")).andExpect(status().isForbidden());
    assertThat(getJson("/api/me","alice").get("organizations").get(0).get("permissions").toString()).doesNotContain("consultation:read");
  }
  @Test void teamReadAndSelfWriteAreReportedAsReadOnlyForOtherEmployeesRecords() throws Exception {
    var role=roles.findById("lead").orElseThrow();var mixed=new HashMap<>(role.getGrants());mixed.put("consultation:write",DataScope.SELF);mixed.put("customer:write",DataScope.SELF);
    putJson("/api/admin/roles/lead","admin",Map.of("name",role.getName(),"grants",mixed,"active",true,"expectedVersion",role.getVersion()),200);
    var rows=getJson("/api/consultations/customer/customer-a","lead");assertThat(rows.size()).isEqualTo(2);
    for(var row:rows)assertThat(row.get("editable").asBoolean()).isFalse();
    assertThat(getJson("/api/customers","lead").get(0).get("editable").asBoolean()).isFalse();
    assertThat(getJson("/api/consultations/customer/customer-a","alice").get(0).get("editable").asBoolean()).isTrue();
    putJson("/api/consultations/"+aliceRecord.getId(),"lead",save(aliceRecord.getVersion()),404);
  }
  @Test void scopedWritesRevisionsAndFileTicketsDoNotExposeAnotherAgentsRecord() throws Exception {
    putJson("/api/consultations/"+bobRecord.getId(),"alice",save(bobRecord.getVersion()),404);
    mvc.perform(actor(get("/api/consultations/"+bobRecord.getId()+"/revisions"),"alice","a")).andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/editor/files/bob-file/views"),"alice","a")).andExpect(status().isNotFound());verify(platform,never()).getViewTicket(anyString());
    putJson("/api/consultations/"+bobRecord.getId(),"lead",save(bobRecord.getVersion()),200);
    assertThat(getJson("/api/consultations/"+bobRecord.getId()+"/revisions","lead").size()).isEqualTo(1);
    mvc.perform(actor(get("/api/editor/files/bob-file/views"),"lead","a")).andExpect(status().isOk());
    mvc.perform(actor(post("/api/admin/memberships/"+member("lead").getId()+"/revoke"),"admin","a")).andExpect(status().isOk());
    mvc.perform(actor(get("/api/editor/files/bob-file/views"),"lead","a")).andExpect(status().isForbidden());
  }
  @Test void teamCyclesForeignAssignmentsMissingTeamAndVersionConflictsAreRejected() throws Exception {
    var root=teams.findById("root-team").orElseThrow();
    putJson("/api/admin/teams/root-team","admin",Map.of("name",root.getName(),"parentId","child-team","active",true,"expectedVersion",root.getVersion()),400);
    var inactive=new HashMap<String,Object>();inactive.put("name",root.getName());inactive.put("parentId",null);inactive.put("active",false);inactive.put("expectedVersion",root.getVersion());
    putJson("/api/admin/teams/root-team","admin",inactive,409);
    putJson("/api/admin/memberships/"+member("alice").getId()+"/access","admin",assignment("alice","foreign-team",Set.of("self"),Set.of(),DataScope.SELF),404);
    putJson("/api/admin/memberships/"+member("alice").getId()+"/access","admin",assignment("alice","root-team",Set.of("foreign-role"),Set.of(),DataScope.SELF),404);
    putJson("/api/admin/memberships/"+member("alice").getId()+"/access","admin",assignment("alice",null,Set.of("lead"),Set.of(),DataScope.SELF),400);
    var valid=assignment("alice","root-team",Set.of("lead"),Set.of(),DataScope.SELF);
    putJson("/api/admin/memberships/"+member("alice").getId()+"/access","admin",valid,200);
    putJson("/api/admin/memberships/"+member("alice").getId()+"/access","admin",valid,409);
  }
  @Test void administratorsGrantedByRoleAreProtectedWhenRoleOrAssignmentIsRemoved() throws Exception {
    var role=roles.save(new OrganizationRole("administrator","a","관리자",Map.of("organization:admin",DataScope.ORGANIZATION)));
    putJson("/api/admin/memberships/"+member("admin").getId()+"/access","admin",assignment("admin",null,Set.of(role.getId()),Set.of(),DataScope.SELF),200);
    assertThat(getJson("/api/admin/organizations","admin").size()).isEqualTo(1);
    putJson("/api/admin/roles/administrator","admin",Map.of("name",role.getName(),"grants",Map.of(),"active",false,"expectedVersion",role.getVersion()),409);
    putJson("/api/admin/memberships/"+member("admin").getId()+"/access","admin",assignment("admin",null,Set.of(),Set.of(),DataScope.SELF),409);
    assertThat(authority.isAdmin(member("admin"))).isTrue();
  }
  @Test void sharedWaitingQueueIsVisibleToAcceptorsButAnotherTeamsActiveQueueIsHidden() throws Exception {
    var waiting=new QueueItem("waiting",QueueItem.ItemType.CALL,Customer.CustomerType.INDIVIDUAL,"접수",null,"010","waiting","normal","request",true,false,false);waiting.setOrganizationId("a");queues.save(waiting);
    assertThat(getJson("/api/queue","alice").size()).isEqualTo(1);
    mvc.perform(actor(post("/api/agents/me/heartbeat"),"bob","a")).andExpect(status().isOk());
    mvc.perform(actor(put("/api/agents/me/status"),"bob","a").contentType(MediaType.APPLICATION_JSON).content("{\"state\":\"AVAILABLE\",\"expectedVersion\":0}")).andExpect(status().isOk());
    var offered=attempts.activeForQueue("a","waiting").orElseThrow();
    mvc.perform(actor(post("/api/queue/waiting/accept"),"bob","a").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("attemptId",offered.getId())))).andExpect(status().isOk());
    assertThat(getJson("/api/queue","alice").size()).isEqualTo(0);
    assertThat(getJson("/api/queue","lead").size()).isEqualTo(1);
    assertThat(getJson("/api/queue","bob").size()).isEqualTo(1);
  }
  @Test void competingRoleRemovalsCannotRemoveTheLastEffectiveAdministrator() throws Exception {
    for(String id:List.of("admin-one","admin-two"))roles.save(new OrganizationRole(id,"a",id,Map.of("organization:admin",DataScope.ORGANIZATION)));
    putJson("/api/admin/memberships/"+member("admin").getId()+"/access","root",assignment("admin",null,Set.of("admin-one"),Set.of(),DataScope.SELF),200);
    putJson("/api/admin/memberships/"+member("bob").getId()+"/access","root",assignment("bob","child-team",Set.of("admin-two"),Set.of(),DataScope.SELF),200);
    var executor=java.util.concurrent.Executors.newFixedThreadPool(2);var start=new java.util.concurrent.CountDownLatch(1);
    try {
      var tasks=new ArrayList<java.util.concurrent.Future<Integer>>();
      for(String id:List.of("admin-one","admin-two"))tasks.add(executor.submit(()->{
        start.await();return mvc.perform(actor(put("/api/admin/roles/"+id),"root","a").contentType(MediaType.APPLICATION_JSON)
          .content(json.writeValueAsString(Map.of("name",id,"active",false,"grants",Map.of(),"expectedVersion",0))))
          .andReturn().getResponse().getStatus();
      }));
      start.countDown();assertThat(List.of(tasks.get(0).get(15,java.util.concurrent.TimeUnit.SECONDS),tasks.get(1).get(15,java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
      assertThat(members.findByOrganizationIdOrderById("a").stream().filter(authority::isAdmin).count()).isEqualTo(1);
    } finally {executor.shutdownNow();}
  }
  @Test void revokingRoleQueuePermissionTerminatesTheExistingMediaParticipant() throws Exception {
    var q=new QueueItem("media",QueueItem.ItemType.CALL,Customer.CustomerType.INDIVIDUAL,"접수",null,"010","waiting","normal","request",true,false,false);q.setOrganizationId("a");q.acceptBy("bob","Bob");q.assignOwner(owner("bob","child-team"));queues.save(q);
    var worker=new MediaCleanupWorker(queues,members,organizations,properties,media,authority,transfers,java.time.Clock.systemUTC());worker.cleanup();
    assertThat(queues.findByCode("media").orElseThrow().isCallEnded()).isFalse();
    var role=roles.findById("self").orElseThrow();var reduced=new HashMap<>(role.getGrants());reduced.remove("queue:accept");
    putJson("/api/admin/roles/self","admin",Map.of("name",role.getName(),"grants",reduced,"active",true,"expectedVersion",role.getVersion()),200);
    mvc.perform(actor(post("/api/queue/media/token"),"bob","a")).andExpect(status().isForbidden());
    worker.cleanup();assertThat(queues.findByCode("media").orElseThrow().isCallEnded()).isTrue();
    verify(media).removeParticipant("a-media","agent-bob");verify(media).removeParticipant("a-media","customer-media");
  }
}
