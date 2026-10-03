package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.concurrent.*;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.settings.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties={"hellow.platform-admin-issuer=https://identity.example/realms/test","hellow.platform-admin-subject=root"})
@AutoConfigureMockMvc
class AdminIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired OrganizationRepository organizations;
  @Autowired MembershipRepository members;
  @Autowired AuditEventRepository events;
  @Autowired OrganizationInvitationRepository invitations;
  @Autowired SupportSettingsRepository settings;
  @MockitoBean JwtDecoder decoder;
  @BeforeEach void setup() {
    invitations.deleteAll(); settings.deleteAll(); events.deleteAll(); members.deleteAll(); organizations.deleteAll();
    organizations.save(new Organization("org-a","A","public-a"));
    organizations.save(new Organization("org-b","B","public-b"));
    members.save(new Membership("org-a",ISSUER,"alice",OrganizationAdminController.PERMISSIONS));
    members.save(new Membership("org-b",ISSUER,"eve",OrganizationAdminController.PERMISSIONS));
  }
  MockHttpServletRequestBuilder actor(MockHttpServletRequestBuilder r,String subject,String org) {
    return r.with(jwt().jwt(j->j.subject(subject).issuer(ISSUER))).header("X-Organization-ID",org);
  }
  String body(Object value) throws Exception { return json.writeValueAsString(value); }
  @Test void platformAdminIsBoundToSubjectAndDoesNotInheritCustomerAccess() throws Exception {
    mvc.perform(actor(get("/api/admin/context"),"alice","org-a")).andExpect(jsonPath("$.platformAdmin").value(false));
    mvc.perform(actor(post("/api/admin/organizations"),"alice","org-a").contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"New\",\"initialAdminSubject\":\"alice\"}")).andExpect(status().isForbidden());
    mvc.perform(actor(get("/api/admin/memberships"),"alice","org-b")).andExpect(status().isForbidden());
    mvc.perform(actor(get("/api/admin/memberships"),"root","org-b")).andExpect(status().isOk());
    mvc.perform(actor(get("/api/queue"),"root","org-b")).andExpect(status().isForbidden());
    mvc.perform(get("/api/admin/settings/common").with(jwt().jwt(j->j.subject("root").issuer("https://other.example"))))
        .andExpect(status().isForbidden());
  }
  @Test void protectsLastAdminAndSupportsHandoverWithVersionConflict() throws Exception {
    var alice=members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue("org-a",ISSUER,"alice").orElseThrow();
    mvc.perform(actor(post("/api/admin/memberships/"+alice.getId()+"/revoke"),"alice","org-a")).andExpect(status().isConflict());
    mvc.perform(actor(post("/api/admin/memberships"),"alice","org-a").contentType(MediaType.APPLICATION_JSON)
        .content(body(Map.of("subject","bob","permissions",OrganizationAdminController.PERMISSIONS)))).andExpect(status().isOk());
    var bob=members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue("org-a",ISSUER,"bob").orElseThrow();
    mvc.perform(actor(put("/api/admin/memberships/"+alice.getId()),"bob","org-a").contentType(MediaType.APPLICATION_JSON)
        .content(body(Map.of("expectedVersion",alice.getVersion()+1,"permissions",Set.of("queue:read"),"active",true)))).andExpect(status().isConflict());
    mvc.perform(actor(post("/api/admin/memberships/"+alice.getId()+"/revoke"),"bob","org-a")).andExpect(status().isOk());
    mvc.perform(actor(get("/api/queue"),"alice","org-a")).andExpect(status().isForbidden());
    assertThat(events.findTop100ByOrganizationIdOrderByOccurredAtDesc("org-a")).hasSize(2);
    assertThat(bob.getPermissions()).contains("organization:admin");
  }
  @Test void concurrentAdminRemovalsCannotRemoveEveryAdministrator() throws Exception {
    members.save(new Membership("org-a",ISSUER,"bob",OrganizationAdminController.PERMISSIONS));
    var alice=members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue("org-a",ISSUER,"alice").orElseThrow();
    var bob=members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue("org-a",ISSUER,"bob").orElseThrow();
    var executor=Executors.newFixedThreadPool(2);var start=new CountDownLatch(1);
    try {
      var one=executor.submit(()->{start.await();return mvc.perform(actor(post("/api/admin/memberships/"+alice.getId()+"/revoke"),"root","org-a")).andReturn().getResponse().getStatus();});
      var two=executor.submit(()->{start.await();return mvc.perform(actor(post("/api/admin/memberships/"+bob.getId()+"/revoke"),"root","org-a")).andReturn().getResponse().getStatus();});
      start.countDown();assertThat(List.of(one.get(15,TimeUnit.SECONDS),two.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
      assertThat(members.findByOrganizationIdOrderById("org-a").stream().filter(Membership::isActive).count()).isEqualTo(1);
    } finally { executor.shutdownNow(); }
  }
  long putSettings(String scope,String subject,String org,long version,Map<String,Object> values) throws Exception {
    var data=new HashMap<>(values);data.put("expectedVersion",version);
    String result=mvc.perform(actor(put("/api/admin/settings/"+scope),subject,org).contentType(MediaType.APPLICATION_JSON).content(body(data)))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    return json.readTree(result).get("version").asLong();
  }
  @Test void organizationOverridesSurviveCommonChangesAndCanBeRestored() throws Exception {
    long common=putSettings("common","root","org-a",0,Map.of("title","Common 1","description","Shared"));
    long local=putSettings("organization","alice","org-a",0,Map.of("title","A override"));
    common=putSettings("common","root","org-a",common,Map.of("title","Common 2","description","New shared"));
    mvc.perform(get("/api/support/organization/public-a")).andExpect(jsonPath("$.branding.title").value("A override"))
        .andExpect(jsonPath("$.branding.description").value("New shared"));
    mvc.perform(get("/api/support/organization/public-b")).andExpect(jsonPath("$.branding.title").value("Common 2"));
    mvc.perform(actor(put("/api/admin/settings/organization"),"alice","org-a").contentType(MediaType.APPLICATION_JSON)
        .content(body(Map.of("expectedVersion",local+1,"title","Stale write")))).andExpect(status().isConflict());
    putSettings("organization","alice","org-a",local,Map.of());
    mvc.perform(get("/api/support/organization/public-a")).andExpect(jsonPath("$.branding.title").value("Common 2"));
    mvc.perform(actor(put("/api/admin/settings/common"),"alice","org-a").contentType(MediaType.APPLICATION_JSON)
        .content(body(Map.of("expectedVersion",common,"title","Denied")))).andExpect(status().isForbidden());
    assertThat(events.findTop100ByOrganizationIdOrderByOccurredAtDesc("org-a")).hasSize(2);
  }
  @Test void rejectsUnsafeBrandingAndForeignAuditAccess() throws Exception {
    for(var field:List.of(Map.of("logoUrl","javascript:alert(1)"),Map.of("primaryColor","#ffffff"))) {
      var data=new HashMap<String,Object>(field);data.put("expectedVersion",0);
      mvc.perform(actor(put("/api/admin/settings/organization"),"alice","org-a").contentType(MediaType.APPLICATION_JSON).content(body(data))).andExpect(status().isBadRequest());
    }
    mvc.perform(actor(post("/api/session/login"),"alice","org-a")).andExpect(status().isOk());
    mvc.perform(actor(get("/api/admin/audit"),"alice","org-a")).andExpect(jsonPath("$[0].action").value("CRM_LOGIN"));
    mvc.perform(actor(get("/api/admin/audit"),"alice","org-b")).andExpect(status().isForbidden());
  }
  @Test void invitationsBindVerifiedEmailAndAreRevocableAndSingleUse() throws Exception {
    String created=mvc.perform(actor(post("/api/admin/invitations"),"alice","org-a").contentType(MediaType.APPLICATION_JSON)
        .content(body(Map.of("email","new@example.com","permissions",Set.of("queue:read"))))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    var data=json.readTree(created);String token=data.get("path").asText().split("token=")[1];
    var request=post("/api/invitations/accept").contentType(MediaType.APPLICATION_JSON).content(body(Map.of("token",token)));
    mvc.perform(request.with(jwt().jwt(j->j.subject("new").issuer(ISSUER).claim("email","wrong@example.com").claim("email_verified",true))))
        .andExpect(status().isForbidden());
    mvc.perform(request.with(jwt().jwt(j->j.subject("new").issuer(ISSUER).claim("email","new@example.com").claim("email_verified",false))))
        .andExpect(status().isForbidden());
    for(int i=0;i<2;i++)mvc.perform(post("/api/invitations/accept").contentType(MediaType.APPLICATION_JSON).content(body(Map.of("token",token)))
        .with(jwt().jwt(j->j.subject("new").issuer(ISSUER).claim("email","new@example.com").claim("email_verified",true))))
        .andExpect(status().isOk());
    assertThat(members.findByOrganizationIdOrderById("org-a")).hasSize(2);
    mvc.perform(actor(post("/api/admin/invitations/"+data.get("id").asText()+"/cancel"),"alice","org-a")).andExpect(status().isConflict());
    var added=members.findByOrganizationIdAndIssuerAndSubjectAndActiveTrue("org-a",ISSUER,"new").orElseThrow();
    mvc.perform(actor(post("/api/admin/memberships/"+added.getId()+"/revoke"),"alice","org-a")).andExpect(status().isOk());
    mvc.perform(post("/api/invitations/accept").contentType(MediaType.APPLICATION_JSON).content(body(Map.of("token",token)))
        .with(jwt().jwt(j->j.subject("new").issuer(ISSUER).claim("email","new@example.com").claim("email_verified",true))))
        .andExpect(status().isConflict());
  }
}
