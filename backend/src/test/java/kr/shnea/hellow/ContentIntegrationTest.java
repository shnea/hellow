package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import java.util.concurrent.*;
import kr.shnea.hellow.content.*;
import kr.shnea.hellow.consultation.*;
import kr.shnea.hellow.customer.*;
import kr.shnea.hellow.security.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:content;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
    "hellow.platform-admin-issuer=https://identity.example/realms/test","hellow.platform-admin-subject=root"})
@AutoConfigureMockMvc
class ContentIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired OrganizationRepository organizations;
  @Autowired MembershipRepository members;@Autowired AuditEventRepository events;
  @Autowired ConsultationCatalogRepository catalogs;@Autowired TextTemplateRepository templates;
  @Autowired ConsultationRepository records;@Autowired ConsultationRevisionRepository revisions;@Autowired CustomerRepository customers;
  @MockitoBean JwtDecoder decoder;
  @BeforeEach void setup(){
    revisions.deleteAll();records.deleteAll();customers.deleteAll();
    // Overrides reference common templates, so delete them first.
    templates.findAll().stream().filter(t->t.getOriginId()!=null).forEach(templates::delete);
    templates.deleteAll();catalogs.deleteAll();events.deleteAll();members.deleteAll();organizations.deleteAll();
    organizations.save(new Organization("a","A","public-a"));organizations.save(new Organization("b","B","public-b"));
    members.save(new Membership("a",ISSUER,"admin",OrganizationAdminController.PERMISSIONS));
    members.save(new Membership("b",ISSUER,"eve",OrganizationAdminController.PERMISSIONS));
    members.save(new Membership("a",ISSUER,"alice",Set.of("consultation:read","consultation:write","customer:read","template:personal")));
    members.save(new Membership("a",ISSUER,"bob",Set.of("consultation:read","consultation:write","template:personal")));
    var c=new Customer("customer",Customer.CustomerType.INDIVIDUAL,true,"Customer",null,null,null,"Standard","010",null,null,null,false);c.setOrganizationId("a");customers.save(c);
  }
  MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder r,String who,String org){return r.with(jwt().jwt(j->j.subject(who).issuer(ISSUER))).header("X-Organization-ID",org);}
  String body(Object v)throws Exception{return json.writeValueAsString(v);}
  JsonNode response(ResultActions result)throws Exception{return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
  JsonNode getCatalog(String scope,String who,String org)throws Exception{return response(mvc.perform(actor(get("/api/admin/consultation-catalog/"+scope),who,org)));}
  List<Map<String,Object>> categories(String thirdName){return List.of(Map.of("id","general","name","일반 상담","active",true),
      Map.of("id","general-inquiry","parentId","general","name","일반 문의","active",true),
      Map.of("id","detail","parentId","general-inquiry","name",thirdName,"active",true));}
  Map<String,Object> catalogBody(JsonNode view,List<Map<String,Object>> cats,boolean inherit){return Map.of("expectedVersion",view.path("version").asLong(),"expectedCommonVersion",view.path("commonVersion").asLong(),"inherit",inherit,
      "catalog",Map.of("categories",cats,"results",List.of(Map.of("id","resolved","name","처리 완료","active",true),Map.of("id","followup","name","후속 조치 필요","active",true))));}
  JsonNode saveCatalog(String scope,String who,String org,JsonNode previous,List<Map<String,Object>> cats)throws Exception{return response(mvc.perform(actor(put("/api/admin/consultation-catalog/"+scope),who,org).contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(previous,cats,false)))));}
  Map<String,Object> templateBody(long version,String name,String text,String origin,long commonVersion){var b=new HashMap<String,Object>();b.put("expectedVersion",version);b.put("name",name);b.put("body",text);b.put("active",true);b.put("originId",origin);b.put("expectedCommonVersion",commonVersion);return b;}
  @Test void catalogHasThreeLevelValidationTenantBoundaryAndFirstSaveConflict()throws Exception{
    var original=getCatalog("organization","admin","a");
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(original,categories("상세"),false)))).andExpect(status().isForbidden());
    mvc.perform(actor(get("/api/admin/consultation-catalog/organization"),"admin","b")).andExpect(status().isForbidden());
    var saved=saveCatalog("organization","admin","a",original,categories("상세"));assertThat(saved.path("version").asLong()).isEqualTo(1);
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(original,categories("덮어쓰기"),false)))).andExpect(status().isConflict());
    var four=new ArrayList<>(categories("상세"));four.add(Map.of("id","four","parentId","detail","name","4단계","active",true));
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(saved,four,false)))).andExpect(status().isBadRequest());
    var cycle=new ArrayList<>(categories("상세"));cycle.set(0,Map.of("id","general","parentId","detail","name","일반 상담","active",true));
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(saved,cycle,false)))).andExpect(status().isBadRequest());
    var missing=new ArrayList<>(categories("상세"));missing.set(2,Map.of("id","detail","parentId","foreign","name","상세","active",true));
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(saved,missing,false)))).andExpect(status().isBadRequest());
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(saved,categories("상세").subList(0,2),false)))).andExpect(status().isBadRequest());
  }
  @Test void commonInheritanceOverrideRestoreAndStaleCommonCopyAreExplicit()throws Exception{
    var root=getCatalog("common","root","a");saveCatalog("common","root","a",root,categories("공통 상세"));
    var inherited=getCatalog("organization","admin","a");assertThat(inherited.path("inherited").asBoolean()).isTrue();
    saveCatalog("organization","admin","a",inherited,categories("조직 상세"));
    root=getCatalog("common","root","a");saveCatalog("common","root","a",root,categories("새 공통 상세"));
    assertThat(getCatalog("organization","admin","a").path("effective").toString()).contains("조직 상세");
    assertThat(getCatalog("organization","eve","b").path("effective").toString()).contains("새 공통 상세");
    var staleInherited=getCatalog("organization","eve","b");root=getCatalog("common","root","a");saveCatalog("common","root","a",root,categories("다시 공통"));
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"eve","b").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(staleInherited,categories("오래된 복사"),false)))).andExpect(status().isConflict());
    var own=getCatalog("organization","admin","a");var reset=response(mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(own,categories("무시"),true)))));
    assertThat(reset.path("inherited").asBoolean()).isTrue();assertThat(reset.path("effective").toString()).contains("다시 공통");
    mvc.perform(actor(get("/api/admin/consultation-catalog/impact/common"),"root","a")).andExpect(jsonPath("$.length()").value(2));
    mvc.perform(actor(get("/api/admin/consultation-catalog/common"),"admin","a")).andExpect(status().isForbidden());
  }
  @Test void categoryAndResultSnapshotsSurviveRenameRetirementAndLegacyEdits()throws Exception{
    saveCatalog("organization","admin","a",getCatalog("organization","admin","a"),categories("원래 상세"));
    var created=response(mvc.perform(actor(post("/api/consultations"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(Map.of("customerCode","customer","requestId",UUID.randomUUID())))));
    long id=created.path("id").asLong();
    var request=saveRequest(created.path("version").asLong(),"detail",null,false);
    var saved=response(mvc.perform(actor(put("/api/consultations/"+id),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(request))));
    assertThat(saved.path("categoryPath").asText()).contains("원래 상세");assertThat(saved.path("categoryMain").asText()).isEqualTo("일반 상담");
    mvc.perform(actor(put("/api/consultations/"+id),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(saveRequest(saved.path("version").asLong(),"detail",null,true)))).andExpect(status().isBadRequest());
    var completed=response(mvc.perform(actor(put("/api/consultations/"+id),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(saveRequest(saved.path("version").asLong(),"detail","resolved",true)))));
    var view=getCatalog("organization","admin","a");var cats=new ArrayList<>(categories("이름 변경"));cats.set(2,Map.of("id","detail","parentId","general-inquiry","name","이름 변경","active",false));
    var update=catalogBody(view,cats,false);update=new HashMap<>(update);update.put("catalog",Map.of("categories",cats,"results",List.of(Map.of("id","resolved","name","바뀐 결과","active",false),Map.of("id","followup","name","후속 조치 필요","active",true))));
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(update))).andExpect(status().isOk());
    var unchanged=response(mvc.perform(actor(put("/api/consultations/"+id),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(saveRequest(completed.path("version").asLong(),"detail","resolved",true)))));
    assertThat(unchanged.path("categorySub").asText()).isEqualTo("원래 상세");assertThat(unchanged.path("resultName").asText()).isEqualTo("처리 완료");
    var newRecord=response(mvc.perform(actor(post("/api/consultations"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(Map.of("customerCode","customer","requestId",UUID.randomUUID())))));
    mvc.perform(actor(put("/api/consultations/"+newRecord.path("id").asLong()),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(saveRequest(0,"detail","followup",true)))).andExpect(status().isBadRequest());
    assertThat(revisions.findAll().getFirst().getBeforeDocument()).contains("categoryPath");
    var legacy=new Consultation("customer","옛 분류","옛 소분류",Consultation.ConsultationStatus.COMPLETED,"memo","","old",7);legacy.setOrganizationId("a");records.saveAndFlush(legacy);
    var legacySave=saveRequest(0,null,null,true);legacySave.put("categoryMain","옛 분류");legacySave.put("categorySub","옛 소분류");
    mvc.perform(actor(put("/api/consultations/"+legacy.getId()),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(legacySave))).andExpect(status().isOk()).andExpect(jsonPath("$.categorySub").value("옛 소분류"));
  }
  Map<String,Object> saveRequest(long version,String category,String result,boolean complete){var r=new HashMap<String,Object>();r.put("categoryMain","클라이언트 값 무시");r.put("categorySub","클라이언트 값 무시");r.put("categoryId",category);r.put("resultId",result);r.put("expectedVersion",version);r.put("editorDocument",Map.of("format","shnea-editor","content",Map.of("type","doc","content",List.of(Map.of("type","paragraph","content",List.of(Map.of("type","text","text","독립 문서")))))));r.put("memo","독립 문서");r.put("complete",complete);return r;}
  @Test void personalOwnershipCannotBeBypassedByAdminsOtherIssuersOrRevokedPermissions()throws Exception{
    var template=response(mvc.perform(actor(post("/api/templates/personal"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(templateBody(0,"내 양식","비공개 작성 내용",null,0)))));
    String id=template.path("id").asText();String update=body(templateBody(template.path("version").asLong(),"탈취","변경",null,0));
    for(String who:List.of("bob","admin","root")){
      mvc.perform(actor(put("/api/templates/personal/"+id),who,"a").contentType(MediaType.APPLICATION_JSON).content(update)).andExpect(who.equals("root")?status().isForbidden():status().isNotFound());
      mvc.perform(actor(get("/api/admin/templates/organization"),who,"a")).andExpect(who.equals("bob")?status().isForbidden():status().isOk());
    }
    mvc.perform(actor(put("/api/templates/personal/"+id),"eve","b").contentType(MediaType.APPLICATION_JSON).content(update)).andExpect(status().isNotFound());
    mvc.perform(actor(get("/api/templates"),"bob","a")).andExpect(jsonPath("$.length()").value(0));
    mvc.perform(actor(get("/api/templates"),"alice","a")).andExpect(jsonPath("$[0].body").value("비공개 작성 내용"));
    mvc.perform(get("/api/templates/personal").with(jwt().jwt(j->j.subject("alice").issuer("https://another.example"))).header("X-Organization-ID","a")).andExpect(status().isForbidden());
    var member=members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue("a",ISSUER,"alice").orElseThrow();member.update("alice",Set.of("consultation:read"),true);members.save(member);
    mvc.perform(actor(put("/api/templates/personal/"+id),"alice","a").contentType(MediaType.APPLICATION_JSON).content(update)).andExpect(status().isForbidden());
    assertThat(events.findAll()).isEmpty(); // Personal body and metadata do not leak into the organization audit.
  }
  @Test void commonTemplatesRespectOverridesRestoreRetirementAndDocumentIndependence()throws Exception{
    var common=response(mvc.perform(actor(post("/api/admin/templates/common"),"root","a").contentType(MediaType.APPLICATION_JSON).content(body(templateBody(0,"기본 양식","원본 내용",null,0))))).get(0);
    String id=common.path("id").asText();long version=common.path("version").asLong();
    var inherited=response(mvc.perform(actor(get("/api/admin/templates/organization"),"admin","a"))).get(0);assertThat(inherited.path("inherited").asBoolean()).isTrue();
    var override=response(mvc.perform(actor(post("/api/admin/templates/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(templateBody(0,"조직 양식","조직 내용",id,version))))).get(0);
    mvc.perform(actor(put("/api/admin/templates/common/"+id),"root","a").contentType(MediaType.APPLICATION_JSON).content(body(templateBody(version,"새 기본 양식","새 공통 내용",null,0)))).andExpect(status().isOk());
    mvc.perform(actor(get("/api/templates"),"alice","a")).andExpect(jsonPath("$[0].body").value("조직 내용"));
    mvc.perform(actor(get("/api/templates"),"eve","b")).andExpect(jsonPath("$[0].body").value("새 공통 내용"));
    mvc.perform(actor(get("/api/admin/templates/impact/"+id),"root","a")).andExpect(jsonPath("$.length()").value(2));
    String overrideId=override.path("overrideId").asText();
    mvc.perform(actor(post("/api/admin/templates/organization/"+overrideId+"/restore"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(Map.of("expectedVersion",override.path("version").asLong(),"expectedCommonVersion",version)))).andExpect(status().isConflict());
    var reset=response(mvc.perform(actor(post("/api/admin/templates/organization/"+overrideId+"/restore"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(Map.of("expectedVersion",override.path("version").asLong(),"expectedCommonVersion",version+1))))).get(0);assertThat(reset.path("body").asText()).isEqualTo("새 공통 내용");
    // The inserted document is an ordinary independent consultation body, with no live template link.
    var record=new Consultation("customer","旧","記録",Consultation.ConsultationStatus.COMPLETED,"조직 내용","","alice",0);record.setOrganizationId("a");records.save(record);
    var retire=templateBody(version+1,"새 기본 양식","완전히 바뀐 내용",null,0);retire.put("active",false);
    mvc.perform(actor(put("/api/admin/templates/common/"+id),"root","a").contentType(MediaType.APPLICATION_JSON).content(body(retire))).andExpect(status().isOk());
    mvc.perform(actor(get("/api/templates"),"alice","a")).andExpect(jsonPath("$.length()").value(0));assertThat(records.findById(record.getId()).orElseThrow().getMemo()).isEqualTo("조직 내용");
    mvc.perform(actor(put("/api/admin/templates/organization/"+overrideId),"eve","b").contentType(MediaType.APPLICATION_JSON).content(body(templateBody(reset.path("version").asLong(),"타 조직","수정",id,version+2)))).andExpect(status().isNotFound());
  }
  @Test void concurrentPersonalEditsHaveOneWinnerAndPreserveTheOtherDraft()throws Exception{
    var template=response(mvc.perform(actor(post("/api/templates/personal"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(templateBody(0,"내 양식","처음",null,0)))));
    var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
    try{
      var results=new ArrayList<Future<Integer>>();
      for(String text:List.of("첫 편집","다른 편집"))results.add(pool.submit(()->{start.await();return mvc.perform(actor(put("/api/templates/personal/"+template.path("id").asText()),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(templateBody(template.path("version").asLong(),"내 양식",text,null,0)))).andReturn().getResponse().getStatus();}));
      start.countDown();assertThat(List.of(results.get(0).get(10,TimeUnit.SECONDS),results.get(1).get(10,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
    }finally{pool.shutdownNow();}
    assertThat(templates.count()).isEqualTo(1);assertThat(templates.findAll().getFirst().getBody()).isIn("첫 편집","다른 편집");
  }

  @Test void inactiveAncestorsDuplicateNamesNullEntriesAndInactiveResultsAreRejected()throws Exception{
    var view=getCatalog("organization","admin","a");var cats=new ArrayList<>(categories("상세"));cats.set(0,Map.of("id","general","name","일반 상담","active",false));
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(view,cats,false)))).andExpect(status().isBadRequest());
    cats=new ArrayList<>(categories("상세"));cats.add(Map.of("id","duplicate","parentId","general","name","일반 문의","active",true));
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(view,cats,false)))).andExpect(status().isBadRequest());
    cats=new ArrayList<>(categories("상세"));cats.add(null);
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(catalogBody(view,cats,false)))).andExpect(status().isBadRequest());
    var created=response(mvc.perform(actor(post("/api/consultations"),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(Map.of("customerCode","customer","requestId",UUID.randomUUID())))));
    assertThat(created.path("categoryId").asText()).isEqualTo("general");
    mvc.perform(actor(put("/api/consultations/"+created.path("id").asLong()),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(saveRequest(0,"general","unknown-result",true)))).andExpect(status().isBadRequest());
    var missingSelection=saveRequest(0,null,null,false);missingSelection.put("categoryMain","일반 상담");missingSelection.put("categorySub","일반 상담");
    mvc.perform(actor(put("/api/consultations/"+created.path("id").asLong()),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(missingSelection))).andExpect(status().isBadRequest());
    mvc.perform(actor(put("/api/consultations/"+created.path("id").asLong()),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(saveRequest(0,"unknown-category","resolved",true)))).andExpect(status().isBadRequest());
    var resultRetired=new HashMap<>(catalogBody(view,categories("상세"),false));resultRetired.put("catalog",Map.of("categories",categories("상세"),"results",List.of(Map.of("id","resolved","name","처리 완료","active",false),Map.of("id","followup","name","후속 조치 필요","active",true))));
    mvc.perform(actor(put("/api/admin/consultation-catalog/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(resultRetired))).andExpect(status().isOk());
    mvc.perform(actor(put("/api/consultations/"+created.path("id").asLong()),"alice","a").contentType(MediaType.APPLICATION_JSON).content(body(saveRequest(0,"general","resolved",true)))).andExpect(status().isBadRequest());
    assertThat(records.findById(created.path("id").asLong()).orElseThrow().getStatus()).isEqualTo(Consultation.ConsultationStatus.IN_PROGRESS);
    assertThat(revisions.count()).isZero();
  }

  @Test void commonActiveFlagDoesNotEraseAnOrganizationOverrideAndWriterMayReadConfig()throws Exception{
    var common=response(mvc.perform(actor(post("/api/admin/templates/common"),"root","a").contentType(MediaType.APPLICATION_JSON).content(body(templateBody(0,"공통","공통 내용",null,0))))).get(0);
    String id=common.path("id").asText();long version=common.path("version").asLong();
    mvc.perform(actor(post("/api/admin/templates/organization"),"admin","a").contentType(MediaType.APPLICATION_JSON).content(body(templateBody(0,"조직","유지할 내용",id,version)))).andExpect(status().isOk());
    var retired=templateBody(version,"공통","비활성 내용",null,0);retired.put("active",false);
    mvc.perform(actor(put("/api/admin/templates/common/"+id),"root","a").contentType(MediaType.APPLICATION_JSON).content(body(retired))).andExpect(status().isOk());
    mvc.perform(actor(get("/api/templates"),"alice","a")).andExpect(jsonPath("$[0].body").value("유지할 내용"));
    mvc.perform(actor(get("/api/templates"),"eve","b")).andExpect(jsonPath("$.length()").value(0));
    members.save(new Membership("a",ISSUER,"writer",Set.of("consultation:write")));
    mvc.perform(actor(get("/api/consultation-catalog"),"writer","a")).andExpect(status().isOk());
    mvc.perform(actor(get("/api/templates"),"writer","a")).andExpect(status().isOk());
    mvc.perform(actor(post("/api/templates/personal"),"writer","a").contentType(MediaType.APPLICATION_JSON).content(body(templateBody(0,"개인","본문",null,0)))).andExpect(status().isForbidden());
    mvc.perform(actor(get("/api/templates"),"root","a")).andExpect(status().isForbidden());
  }
}
