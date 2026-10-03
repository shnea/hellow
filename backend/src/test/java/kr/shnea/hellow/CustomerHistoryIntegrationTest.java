package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import java.util.concurrent.*;
import kr.shnea.hellow.consultation.*;
import kr.shnea.hellow.customer.*;
import kr.shnea.hellow.followup.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.timeline.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:history;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000")
@AutoConfigureMockMvc
class CustomerHistoryIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired CustomerRepository customers;
  @Autowired QueueItemRepository queues;@Autowired ConsultationRepository records;@Autowired TimelineRepository timelines;
  @Autowired FollowUpRepository followups;@Autowired CustomerHistoryLinkRepository links;
  @Autowired OrganizationRepository organizations;@Autowired MembershipRepository members;@Autowired AuditEventRepository audits;
  @MockitoBean JwtDecoder decoder;
  WorkspaceAccess.Actor owner(String who,String org){return new WorkspaceAccess.Actor(org,who,who,ISSUER,null,DataScope.ORGANIZATION,Set.of(),Map.of());}
  @BeforeEach void setup(){
    links.deleteAll();followups.deleteAll();timelines.deleteAll();records.deleteAll();queues.deleteAll();customers.deleteAll();audits.deleteAll();members.deleteAll();organizations.deleteAll();
    organizations.save(new Organization("a","A","a-public"));organizations.save(new Organization("b","B","b-public"));
    members.save(new Membership("a",ISSUER,"alice",OrganizationAdminController.PERMISSIONS));members.save(new Membership("b",ISSUER,"eve",OrganizationAdminController.PERMISSIONS));
    var bob=new Membership("a",ISSUER,"bob",OrganizationAdminController.PERMISSIONS);bob.assignAccess(null,Set.of(),DataScope.SELF);members.save(bob);
    var c=new Customer("customer",Customer.CustomerType.INDIVIDUAL,true,"등록 고객",null,null,null,"Standard","010-1234-5678",null,"alice",null,false);c.setOrganizationId("a");c.assignOwner(owner("bob","a"));customers.save(c);
  }
  MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder r,String who,String org){return r.with(jwt().jwt(j->j.subject(who).issuer(ISSUER))).header("X-Organization-ID",org);}
  String body(Object value)throws Exception{return json.writeValueAsString(value);}
  JsonNode ok(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
  QueueItem fixture(String code,String who,String org,boolean complete){
    var q=new QueueItem(code,QueueItem.ItemType.TICKET,Customer.CustomerType.INDIVIDUAL,"접수 당시 이름",null,"01012345678",null,"normal","원래 접수",false,false,false);
    q.setOrganizationId(org);q.acceptBy(who,who);q.assignOwner(owner(who,org));if(complete)q.complete();q=queues.saveAndFlush(q);
    var r=new Consultation(null,"당시 대분류","당시 상세",complete?Consultation.ConsultationStatus.COMPLETED:Consultation.ConsultationStatus.IN_PROGRESS,"원래 본문","원래 태그",who,45);
    r.setOrganizationId(org);r.bind(code,who);r.copyOwner(q);records.saveAndFlush(r);
    var t=new TimelineItem(null,TimelineItem.ChannelType.TICKET,who,"원래 제목","타임라인 본문",false,null,"태그");t.setOrganizationId(org);t.setQueueCode(code);t.copyOwner(q);timelines.save(t);
    var f=new FollowUpAction(null,"CALLBACK","콜백 요청","일정 메모");f.setOrganizationId(org);f.setQueueCode(code);f.copyOwner(q);followups.save(f);return q;
  }
  Map<String,Object> selection(String code){var q=queues.findByCode(code).orElseThrow();var r=records.findByOrganizationIdAndQueueCode(q.getOrganizationId(),code).orElseThrow();return Map.of("queueCode",code,"queueVersion",q.getVersion(),"recordVersion",r.getVersion());}
  ResultActions link(String who,String org,List<Map<String,Object>> selected)throws Exception{return mvc.perform(actor(post("/api/customers/customer/history/links"),who,org).contentType(MediaType.APPLICATION_JSON).content(body(Map.of("items",selected))));}
  @Test void registrationSynchronizesAlreadySavedDraftTimelineAndFollowup()throws Exception{
    fixture("active","alice","a",false);
    var saved=ok(mvc.perform(actor(post("/api/customers"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(Map.of("customerType","INDIVIDUAL","name","신규 고객","phoneNumber","01012345678","queueCode","active")))));
    String code=saved.path("code").asText();assertThat(records.findByOrganizationIdAndQueueCode("a","active").orElseThrow().getCustomerCode()).isEqualTo(code);
    assertThat(saved.path("consultationVersion").asLong()).isEqualTo(records.findByOrganizationIdAndQueueCode("a","active").orElseThrow().getVersion());
    assertThat(timelines.findByOrganizationIdAndQueueCodeOrderByCreatedAtDesc("a","active").getFirst().getCustomerCode()).isEqualTo(code);
    assertThat(followups.findByOrganizationIdAndQueueCode("a","active").getFirst().getCustomerCode()).isEqualTo(code);
    mvc.perform(actor(get("/api/consultations/customer/"+code),"alice","a")).andExpect(jsonPath("$.length()").value(1));
  }
  @Test void historyIncludesUnregisteredContactAndEnforcesTenantAndOwnerScope()throws Exception{
    fixture("alice-history","alice","a",true);fixture("bob-history","bob","a",true);fixture("other-org","eve","b",true);
    var all=ok(mvc.perform(actor(get("/api/consultations"),"alice","a")));
    assertThat(all.path("items").size()).isEqualTo(2);
    assertThat(all.path("items").get(0).path("customerName").asText()).isEqualTo("접수 당시 이름");
    assertThat(all.path("items").get(0).path("customerRegistered").asBoolean()).isFalse();
    var own=ok(mvc.perform(actor(get("/api/consultations").param("search","접수 당시"),"bob","a")));
    assertThat(own.path("items").size()).isEqualTo(1);assertThat(own.path("items").get(0).path("queueCode").asText()).isEqualTo("bob-history");
    mvc.perform(actor(get("/api/consultations").param("page","-1"),"alice","a")).andExpect(status().isBadRequest());
  }
  @Test void historicalUnregisteredContactCanBeEditedWithoutRegistrationAndRejectsStaleOrForeignWrites()throws Exception{
    var q=fixture("contact-history","alice","a",true);
    var update=Map.of("expectedVersion",q.getVersion(),"name","수정한 고객","phoneNumber","01098765432","company","회사","customerType","INDIVIDUAL");
    mvc.perform(actor(put("/api/queue/contact-history/contact"),"bob","a").contentType(MediaType.APPLICATION_JSON).content(body(update))).andExpect(status().isNotFound());
    mvc.perform(actor(put("/api/queue/contact-history/contact"),"eve","b").contentType(MediaType.APPLICATION_JSON).content(body(update))).andExpect(status().isNotFound());
    var updated=ok(mvc.perform(actor(put("/api/queue/contact-history/contact"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(update))));
    assertThat(updated.path("customerName").asText()).isEqualTo("수정한 고객");assertThat(updated.path("registered").asBoolean()).isFalse();
    assertThat(queues.findByCode(q.getCode()).orElseThrow().getCustomerCode()).isNull();assertThat(customers.count()).isEqualTo(1);
    mvc.perform(actor(put("/api/queue/contact-history/contact"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(update))).andExpect(status().isConflict());
    var results=ok(mvc.perform(actor(get("/api/consultations").param("search","01098765432"),"alice","a")));
    assertThat(results.path("items").size()).isEqualTo(1);assertThat(results.path("items").get(0).path("customerName").asText()).isEqualTo("수정한 고객");
  }
  @Test void currentExistingCustomerLinkAlsoSynchronizesDraftAndIsIdempotent()throws Exception{
    fixture("active","alice","a",false);
    for(int i=0;i<2;i++)mvc.perform(actor(post("/api/customers/queue/active/link"),"alice","a").contentType(MediaType.APPLICATION_JSON).content("{\"customerCode\":\"customer\"}")).andExpect(status().isOk());
    assertThat(records.findByOrganizationIdAndQueueCode("a","active").orElseThrow().getCustomerCode()).isEqualTo("customer");assertThat(links.count()).isZero();
  }
  @Test void explicitHistoricalLinkAndUndoPreserveOriginalContentOwnerAndTime()throws Exception{
    fixture("old","alice","a",true);var original=records.findByOrganizationIdAndQueueCode("a","old").orElseThrow();var time=original.getCreatedAt();
    var list=ok(mvc.perform(actor(get("/api/customers/customer/history/candidates"),"alice","a")));assertThat(list.path("items").size()).isEqualTo(1);
    assertThat(queues.findByCode("old").orElseThrow().getCustomerCode()).isNull();
    var linked=ok(link("alice","a",List.of(selection("old"))));String id=linked.get(0).path("id").asText();
    var record=records.findByOrganizationIdAndQueueCode("a","old").orElseThrow();assertThat(record.getCustomerCode()).isEqualTo("customer");
    assertThat(record.getMemo()).isEqualTo("원래 본문");assertThat(record.getCategorySub()).isEqualTo("당시 상세");assertThat(record.getCreatedAt()).isEqualTo(time);assertThat(record.getOwnerSubject()).isEqualTo("alice");assertThat(record.getCallDurationSeconds()).isEqualTo(45);
    assertThat(queues.findByCode("old").orElseThrow().getCustomerName()).isEqualTo("접수 당시 이름");
    mvc.perform(actor(get("/api/timeline/customer/customer"),"alice","a")).andExpect(jsonPath("$.length()").value(1));
    mvc.perform(actor(post("/api/customers/customer/history/links/"+id+"/undo"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(selection("old")))).andExpect(status().isOk());
    assertThat(records.findById(record.getId()).orElseThrow().getCustomerCode()).isNull();assertThat(queues.findByCode("old").orElseThrow().isRegistered()).isFalse();
    assertThat(followups.findByOrganizationIdAndQueueCode("a","old").getFirst().getCustomerCode()).isNull();assertThat(links.findById(id).orElseThrow().getUndoneAt()).isNotNull();
  }
  @Test void staleBatchRollsBackAllAssociationsAndRepeatedLinkNeverReassigns()throws Exception{
    fixture("a-first","alice","a",true);fixture("z-second","alice","a",true);
    var stale=new HashMap<>(selection("z-second"));stale.put("recordVersion",99L);
    link("alice","a",List.of(selection("a-first"),stale)).andExpect(status().isConflict());assertThat(links.count()).isZero();assertThat(queues.findByCode("a-first").orElseThrow().getCustomerCode()).isNull();
    ok(link("alice","a",List.of(selection("a-first"))));link("alice","a",List.of(selection("a-first"))).andExpect(status().isConflict());assertThat(links.count()).isEqualTo(1);
  }
  @Test void candidatesAndCommandsApplyTenantSelfScopeAndCurrentPermissions()throws Exception{
    fixture("own","bob","a",true);fixture("other","alice","a",true);fixture("foreign","eve","b",true);fixture("active","bob","a",false);
    var list=ok(mvc.perform(actor(get("/api/customers/customer/history/candidates"),"bob","a")));assertThat(list.path("items").size()).isEqualTo(1);assertThat(list.path("items").get(0).path("queueCode").asText()).isEqualTo("own");
    link("bob","a",List.of(selection("other"))).andExpect(status().isNotFound());link("alice","a",List.of(selection("foreign"))).andExpect(status().isNotFound());link("bob","a",List.of(selection("active"))).andExpect(status().isConflict());
    mvc.perform(actor(get("/api/customers/customer/history/candidates?phone=010"),"alice","a")).andExpect(status().isBadRequest());
    var member=members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue("a",ISSUER,"bob").orElseThrow();member.revoke();members.save(member);
    link("bob","a",List.of(selection("own"))).andExpect(status().isForbidden());
  }
  @Test void concurrentLinksHaveOneWinnerAndNoDuplicateAuditAssociation()throws Exception{
    fixture("race","alice","a",true);var selected=selection("race");var pool=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
    try{var tasks=new ArrayList<Future<Integer>>();for(int i=0;i<2;i++)tasks.add(pool.submit(()->{start.await();return link("alice","a",List.of(selected)).andReturn().getResponse().getStatus();}));start.countDown();
      var statuses=new ArrayList<Integer>();for(var task:tasks)statuses.add(task.get(15,TimeUnit.SECONDS));assertThat(statuses).containsExactlyInAnyOrder(200,409);assertThat(links.count()).isEqualTo(1);
    }finally{pool.shutdownNow();}
  }
  @Test void matchingSubjectFromAnotherIssuerCannotLinkTheActiveConsultation()throws Exception{
    fixture("active","alice","a",false);String other="https://other.example/realms/test";members.save(new Membership("a",other,"alice",OrganizationAdminController.PERMISSIONS));
    mvc.perform(post("/api/customers/queue/active/link").with(jwt().jwt(j->j.subject("alice").issuer(other))).header("X-Organization-ID","a")
      .contentType(MediaType.APPLICATION_JSON).content("{\"customerCode\":\"customer\"}")).andExpect(status().isNotFound());
    assertThat(records.findByOrganizationIdAndQueueCode("a","active").orElseThrow().getCustomerCode()).isNull();
  }
}
