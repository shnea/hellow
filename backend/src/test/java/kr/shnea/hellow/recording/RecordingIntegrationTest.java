package kr.shnea.hellow.recording;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.nio.file.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.customer.Customer;
import kr.shnea.hellow.security.*;
import kr.shnea.hellow.platform.PlatformClient;
import kr.shnea.hellow.livekit.LiveKitService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:recording;MODE=PostgreSQL;DB_CLOSE_DELAY=-1") @AutoConfigureMockMvc
class RecordingIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  @Autowired CallRecordingRepository recordings;@Autowired QueueItemRepository queues;@Autowired MembershipRepository members;@Autowired OrganizationRepository organizations;
  @Autowired ObjectMapper json;@Autowired MockMvc mvc;@Autowired OrganizationRoleRepository roles;
  @MockitoBean JwtDecoder decoder;@MockitoBean EgressClient egress;@MockitoBean PlatformClient platform;@MockitoBean LiveKitService media;
  @TempDir Path directory;QueueItem q;CallRecording r;RecordingWorker worker;
  @BeforeEach void setup(){recordings.deleteAll();queues.deleteAll();members.deleteAll();roles.deleteAll();organizations.deleteAll();
    organizations.save(new Organization("a","A","a"));organizations.save(new Organization("b","B","b"));
    q=new QueueItem("call",QueueItem.ItemType.CALL,Customer.CustomerType.INDIVIDUAL,"Customer",null,"01012345678",null,"normal","Call",false,false,false);q.setOrganizationId("a");q.acceptBy("alice","Alice");q.assignOwner(new WorkspaceAccess.Actor("a","alice","Alice",ISSUER,null,DataScope.SELF,Set.of(),Map.of()));q=queues.saveAndFlush(q);r=recordings.saveAndFlush(new CallRecording(q));
    when(media.participantConnection(anyString(),anyString())).thenReturn(new LiveKitService.ParticipantConnection(true,true,"sid"));
    worker=new RecordingWorker(recordings,queues,egress,media,platform,directory.toString());
  }
  @Test void lostStartResponseIsRecoveredWithoutDuplicateCaptureAndUploadRetriesWithSameRequestId()throws Exception{
    when(egress.list("a-call")).thenReturn(json.readTree("[]"),json.readTree("[{\"egress_id\":\"e1\",\"status\":\"EGRESS_ACTIVE\"}]"),json.readTree("[{\"egress_id\":\"e1\",\"status\":\"EGRESS_COMPLETE\",\"file_results\":[{\"duration\":\"8000000000\"}]}]"));
    when(egress.start(anyString(),anyString())).thenThrow(new RuntimeException("response lost"));
    worker.process(r.getId());assertThat(recordings.findById(r.getId()).orElseThrow().getState()).isEqualTo(CallRecording.State.STARTING);
    worker.process(r.getId());assertThat(recordings.findById(r.getId()).orElseThrow().getEgressId()).isEqualTo("e1");verify(egress,times(1)).start(anyString(),anyString());
    q.endCall();queues.saveAndFlush(q);worker.process(r.getId());
    Path file=directory.resolve(r.getId()+".ogg");Files.write(file,new byte[]{1,2,3});
    when(platform.uploadFile(file,r.getId())).thenThrow(new java.io.IOException("temporary upload failure")).thenReturn(new PlatformClient.FileUploadResult("private-file","call.ogg",3,"sha","unused","COMPLETED"));
    worker.process(r.getId());assertThat(Files.exists(file)).isTrue();assertThat(recordings.findById(r.getId()).orElseThrow().getState()).isEqualTo(CallRecording.State.UPLOADING);
    worker.process(r.getId());var saved=recordings.findById(r.getId()).orElseThrow();assertThat(saved.getState()).isEqualTo(CallRecording.State.READY);assertThat(saved.getFileId()).isEqualTo("private-file");assertThat(saved.getDurationSeconds()).isEqualTo(8);assertThat(Files.exists(file)).isFalse();
  }
  @Test void noAudioAndConcurrentWorkerDoNotStartRecording(){
    when(media.participantConnection(anyString(),anyString())).thenReturn(new LiveKitService.ParticipantConnection(false,false,""));worker.process(r.getId());verifyNoInteractions(egress);
    assertThat(recordings.claim(r.getId(),java.time.Instant.now(),java.time.Instant.now().plusSeconds(60))).isEqualTo(1);worker.process(r.getId());verifyNoInteractions(egress);
  }
  @Test void playbackAndDownloadRequireIndependentScopeEvenWithOrganizationConsultationRead()throws Exception{
    r.ready("private-file");recordings.saveAndFlush(r);
    var selfRole=roles.save(new OrganizationRole("self","a","Audio self",Map.of("recording:read",DataScope.SELF)));
    for(String who:List.of("alice","bob")){var m=new Membership("a",ISSUER,who,Set.of("consultation:read"));m.assignAccess(null,Set.of(selfRole.getId()),DataScope.ORGANIZATION);members.save(m);}
    members.save(new Membership("a",ISSUER,"reader",Set.of("consultation:read")));members.save(new Membership("b",ISSUER,"eve",Set.of("consultation:read","recording:read")));
    when(platform.getViewTicket("private-file")).thenReturn(Map.of("originalUrl","https://example.test/private"));
    for(String action:List.of("playback","download")){
      for(String who:List.of("bob","eve","reader"))mvc.perform(post("/api/recordings/"+r.getId()+"/"+action).with(jwt().jwt(j->j.issuer(ISSUER).subject(who))).header("X-Organization-ID",who.equals("eve")?"b":"a")).andExpect(status().is(who.equals("reader")?403:404));
      mvc.perform(post("/api/recordings/"+r.getId()+"/"+action).with(jwt().jwt(j->j.issuer(ISSUER).subject("alice"))).header("X-Organization-ID","a")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
    }
    verify(platform,times(2)).getViewTicket("private-file");
  }
}
