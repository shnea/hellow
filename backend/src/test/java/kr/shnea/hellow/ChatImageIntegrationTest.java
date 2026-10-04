package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import javax.imageio.ImageIO;
import kr.shnea.hellow.chat.*;
import kr.shnea.hellow.platform.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

@SpringBootTest(properties="platform.api-key=synthetic-file-key") @AutoConfigureMockMvc
class ChatImageIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  @Autowired MockMvc mvc;@Autowired QueueItemRepository queues;@Autowired OrganizationRepository organizations;
  @Autowired MembershipRepository members;@Autowired ChatImageService images;@Autowired ChatService chat;
  @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
  @MockitoBean JwtDecoder decoder;@MockitoBean PlatformClient platform;
  String org,code,session;byte[] png;
  WorkspaceAccess.Actor actor(String sub){return new WorkspaceAccess.Actor(org,sub,sub,ISSUER,null,DataScope.SELF,Set.of(),Map.of("queue:read",DataScope.SELF,"queue:accept",DataScope.SELF),"queue:read",Set.of(),Set.of());}
  MockMultipartFile file(){return new MockMultipartFile("file","evidence.png","image/png",png);}
  @BeforeEach void setup()throws Exception{
    org="chat-image-"+UUID.randomUUID();organizations.save(new Organization(org,"Images",org));
    members.save(new Membership(org,ISSUER,"agent",Set.of("queue:read","queue:accept","consultation:read")));
    var body=Map.of("organizationCode",org,"requestId",UUID.randomUUID().toString(),"customerName","Image customer","phoneNumber","01012345678","customerType","INDIVIDUAL","inquiryType","Support","message","Inquiry","channel","CHAT");
    var r=json.readTree(mvc.perform(post("/api/support/request").contentType("application/json").content(json.writeValueAsString(body))).andReturn().getResponse().getContentAsString());code=r.get("queueCode").asText();session=r.get("sessionId").asText();
    var q=queues.findByCode(code).orElseThrow();q.acceptBy("agent","Agent");q.assignOwner(actor("agent"));queues.saveAndFlush(q);
    var output=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(4,4,BufferedImage.TYPE_INT_RGB),"png",output);png=output.toByteArray();
    when(platform.uploadFile(any(org.springframework.web.multipart.MultipartFile.class),anyString())).thenAnswer(invocation->{var f=invocation.<org.springframework.web.multipart.MultipartFile>getArgument(0);return new PlatformClient.FileUploadResult("private-"+invocation.getArgument(1),f.getOriginalFilename(),f.getSize(),HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(f.getBytes())),"unused-secret-capability","COMPLETED");});
    when(platform.getViewTicket(anyString())).thenReturn(Map.of("originalUrl","https://files.example/image?ticket=synthetic","shareUrl","must-not-expose"));
  }
  @Test void imagePersistsInTranscriptWithoutPrivateIdsAndTicketsRequireConversationAccess()throws Exception{
    mvc.perform(multipart("/api/support/chat/images").file(file()).param("clientMessageId",UUID.randomUUID().toString()).header("X-Support-Session",session)).andExpect(status().isOk()).andExpect(jsonPath("$.sequence").value(2)).andExpect(jsonPath("$.image.mime").value("image/png")).andExpect(jsonPath("$.image.fileId").doesNotExist()).andExpect(jsonPath("$.image.sha256").doesNotExist());
    mvc.perform(get("/api/support/chat/messages").header("X-Support-Session",session)).andExpect(jsonPath("$.messages[1].image.name").value("evidence.png"));
    mvc.perform(get("/api/support/chat/images/2/views").header("X-Support-Session",session)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.shareUrl").doesNotExist());
    mvc.perform(get("/api/chat/"+code+"/images/2/views").header("X-Organization-ID",org).with(jwt().jwt(j->j.issuer(ISSUER).subject("agent")))).andExpect(status().isOk());
    mvc.perform(get("/api/support/chat/images/2/views").header("X-Support-Session","other-capability")).andExpect(status().isNotFound());
    mvc.perform(get("/api/chat/"+code+"/images/2/views")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/chat/"+code+"/images/2/views").header("X-Organization-ID",org+"-other").with(jwt().jwt(j->j.issuer(ISSUER).subject("agent")))).andExpect(status().isForbidden());
    mvc.perform(get("/api/support/chat/images/1/views").header("X-Support-Session",session)).andExpect(status().isNotFound());
  }
  @Test void concurrentRetriesStoreOneImageAndClosedConversationAcknowledgesIt()throws Exception{
    String id=UUID.randomUUID().toString();var pool=Executors.newFixedThreadPool(2);
    try{var a=pool.submit(()->images.send(session,id,file()));var b=pool.submit(()->images.send(session,id,file()));assertThat(a.get(10,TimeUnit.SECONDS).sequence()).isEqualTo(b.get(10,TimeUnit.SECONDS).sequence());}finally{pool.shutdownNow();}
    verify(platform,times(1)).uploadFile(any(org.springframework.web.multipart.MultipartFile.class),anyString());
    chat.customerEnd(session);assertThat(images.send(session,id,file()).sequence()).isEqualTo(2);
    assertThatThrownBy(()->images.send(session,UUID.randomUUID().toString(),file())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThat(images.customerView(session,2)).containsKey("originalUrl");
    assertThatThrownBy(()->chat.customerSend(session,id,"text replaces image")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void changedBytesAndTextImageIdCollisionAreRejected()throws Exception{
    String id=UUID.randomUUID().toString();images.send(session,id,file());
    var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(6,6,BufferedImage.TYPE_INT_RGB),"png",out);
    assertThatThrownBy(()->images.send(session,id,new MockMultipartFile("file","other.png","image/png",out.toByteArray()))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    String textId=UUID.randomUUID().toString();chat.customerSend(session,textId,"text");assertThatThrownBy(()->images.send(session,textId,file())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThat(chat.customerRead(session,0).messages()).hasSize(3);
  }
  @Test void invalidSvgSpoofedAndOversizedFilesNeverReachPlatform()throws Exception{
    for(var f:List.of(new MockMultipartFile("file","image.png","image/png","<svg onload='attack()'/ >".getBytes()),new MockMultipartFile("file","large.png","image/png",new byte[5*1024*1024+1]),new MockMultipartFile("file","empty.png","image/png",new byte[0]))){
      mvc.perform(multipart("/api/support/chat/images").file(f).param("clientMessageId",UUID.randomUUID().toString()).header("X-Support-Session",session)).andExpect(status().isBadRequest());
    }
    verify(platform,never()).uploadFile(any(org.springframework.web.multipart.MultipartFile.class),anyString());assertThat(chat.customerRead(session,0).cursor()).isEqualTo(1);
  }
  @Test void platformFailureRollsBackSequenceAndSameIdCanRecover()throws Exception{
    String id=UUID.randomUUID().toString();
    var failure=new java.util.concurrent.atomic.AtomicBoolean(true);
    when(platform.uploadFile(any(org.springframework.web.multipart.MultipartFile.class),anyString())).thenAnswer(inv->{if(failure.getAndSet(false))throw new ResponseStatusException(HttpStatus.BAD_GATEWAY);return new PlatformClient.FileUploadResult("recovered", "evidence.png",png.length,HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(png)),"unused","COMPLETED");});
    assertThatThrownBy(()->images.send(session,id,file())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);assertThat(chat.customerRead(session,0).cursor()).isEqualTo(1);
    assertThat(images.send(session,id,file()).sequence()).isEqualTo(2);
  }
  @Test void quotaAndRevokedPermissionPreventNewUploadAndTicketIssuance()throws Exception{
    for(int i=0;i<20;i++)images.send(session,UUID.randomUUID().toString(),file());
    assertThatThrownBy(()->images.send(session,UUID.randomUUID().toString(),file())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);verify(platform,times(20)).uploadFile(any(org.springframework.web.multipart.MultipartFile.class),anyString());
    members.deleteAll(members.findAll().stream().filter(m->org.equals(m.getOrganizationId())).toList());
    mvc.perform(get("/api/chat/"+code+"/images/2/views").header("X-Organization-ID",org).with(jwt().jwt(j->j.issuer(ISSUER).subject("agent")))).andExpect(status().isForbidden());
  }
  @Test void detectedJpegAndHistoryPermissionAreIndependentOfFilenameAndQueueRead()throws Exception{
    var output=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(4,4,BufferedImage.TYPE_INT_RGB),"jpeg",output);
    var image=images.send(session,UUID.randomUUID().toString(),new MockMultipartFile("file","../camera.dat","application/octet-stream",output.toByteArray()));
    assertThat(image.image().mime()).isEqualTo("image/jpeg");assertThat(image.image().name()).isEqualTo("camera.dat");
    var m=members.findAll().stream().filter(member->org.equals(member.getOrganizationId())).findFirst().orElseThrow();
    ReflectionTestUtils.setField(m,"permissions",new HashSet<>(Set.of("consultation:read")));members.saveAndFlush(m);
    mvc.perform(get("/api/chat/"+code+"/images/2/views").header("X-Organization-ID",org).with(jwt().jwt(j->j.issuer(ISSUER).subject("agent")))).andExpect(status().isForbidden());
    mvc.perform(get("/api/chat/"+code+"/images/2/views").param("history","true").header("X-Organization-ID",org).with(jwt().jwt(j->j.issuer(ISSUER).subject("agent")))).andExpect(status().isOk());
    var q=queues.findByCode(code).orElseThrow();ReflectionTestUtils.setField(q,"supportExpiresAt",java.time.Instant.now().minusSeconds(1));queues.saveAndFlush(q);
    mvc.perform(get("/api/support/chat/images/2/views").header("X-Support-Session",session)).andExpect(status().isGone());
  }
}
