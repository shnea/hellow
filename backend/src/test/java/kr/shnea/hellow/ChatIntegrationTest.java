package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import kr.shnea.hellow.chat.*;
import kr.shnea.hellow.queue.*;
import kr.shnea.hellow.security.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.util.ReflectionTestUtils;

@SpringBootTest @AutoConfigureMockMvc
class ChatIntegrationTest {
  static final String ISSUER="https://identity.example/realms/test";
  @Autowired MockMvc mvc;@Autowired QueueItemRepository queues;@Autowired ChatMessageRepository messages;
  @Autowired OrganizationRepository organizations;@Autowired MembershipRepository members;
  @Autowired com.fasterxml.jackson.databind.ObjectMapper json;@Autowired ChatService chat;
  @Autowired ChatStreams streams;
  @Autowired kr.shnea.hellow.support.SupportExpiryService expiry;
  @MockitoBean JwtDecoder decoder;
  String org,code,session;
  WorkspaceAccess.Actor actor(String subject){return new WorkspaceAccess.Actor(org,subject,subject,ISSUER,null,DataScope.SELF,Set.of(),Map.of("queue:read",DataScope.SELF,"queue:accept",DataScope.SELF),"queue:read",Set.of(),Set.of());}
  @BeforeEach void setup()throws Exception{
    org="chat-"+UUID.randomUUID();organizations.save(new Organization(org,"Chat",org));
    members.save(new Membership(org,ISSUER,"agent",Set.of("queue:read","queue:accept","consultation:read")));
    var body=Map.of("organizationCode",org,"requestId",UUID.randomUUID().toString(),"customerName","Customer","phoneNumber","01012345678","customerType","INDIVIDUAL","inquiryType","Support","message","First inquiry","channel","CHAT");
    var r=json.readTree(mvc.perform(post("/api/support/request").contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    code=r.get("queueCode").asText();session=r.get("sessionId").asText();
    var q=queues.findByCode(code).orElseThrow();q.acceptBy("agent","Agent");q.assignOwner(actor("agent"));queues.saveAndFlush(q);
  }
  @Test void bidirectionalMessagesPersistInOrderAndReplayOnlyMissingRows()throws Exception{
    mvc.perform(post("/api/support/chat/messages").header("X-Support-Session",session).contentType("application/json").content(json.writeValueAsString(Map.of("clientMessageId",UUID.randomUUID().toString(),"body","Customer reply")))).andExpect(status().isOk()).andExpect(jsonPath("$.sequence").value(2));
    mvc.perform(post("/api/chat/"+code+"/messages").header("X-Organization-ID",org).with(jwt().jwt(j->j.issuer(ISSUER).subject("agent"))).contentType("application/json").content(json.writeValueAsString(Map.of("clientMessageId",UUID.randomUUID().toString(),"body","Agent reply")))).andExpect(status().isOk()).andExpect(jsonPath("$.sequence").value(3));
    mvc.perform(get("/api/support/chat/messages").header("X-Support-Session",session).param("afterSequence","1")).andExpect(jsonPath("$.messages.length()").value(2)).andExpect(jsonPath("$.messages[0].body").value("Customer reply")).andExpect(jsonPath("$.messages[1].body").value("Agent reply")).andExpect(jsonPath("$.cursor").value(3));
    assertThat(chat.customerRead(session,0).messages()).hasSize(3);
  }
  @Test void concurrentDuplicateSendsAllocateOneSequenceAndRejectChangedBody()throws Exception{
    String id=UUID.randomUUID().toString();var pool=Executors.newFixedThreadPool(2);
    try{var a=pool.submit(()->chat.customerSend(session,id,"Same"));var b=pool.submit(()->chat.customerSend(session,id,"Same"));assertThat(a.get(10,TimeUnit.SECONDS).sequence()).isEqualTo(b.get(10,TimeUnit.SECONDS).sequence());}finally{pool.shutdownNow();}
    assertThat(chat.customerRead(session,0).messages()).hasSize(2);
    assertThatThrownBy(()->chat.customerSend(session,id,"Different")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void endIsIdempotentKeepsStaffAfterworkAndAcknowledgesLostSendResponse()throws Exception{
    String id=UUID.randomUUID().toString();var sent=chat.customerSend(session,id,"Delivered");
    chat.staffEnd(actor("agent"),code);chat.customerEnd(session);
    assertThat(chat.customerRead(session,0).state()).isEqualTo("CLOSED");assertThat(chat.customerRead(session,0).messages()).hasSize(2);
    assertThat(chat.customerSend(session,id,"Delivered").sequence()).isEqualTo(sent.sequence());
    assertThatThrownBy(()->chat.customerSend(session,UUID.randomUUID().toString(),"Too late")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    assertThat(queues.findByCode(code).orElseThrow().getStatus()).isEqualTo(QueueItem.QueueStatus.PROCESSING);
  }
  @Test void concurrentEndAndSendLeaveNoMessageAfterTheClosingBoundary()throws Exception{
    var pool=Executors.newFixedThreadPool(2);try{
      var end=pool.submit(()->chat.customerEnd(session));var send=pool.submit(()->{try{return chat.staffSend(actor("agent"),code,UUID.randomUUID().toString(),"Racing");}catch(org.springframework.web.server.ResponseStatusException e){return null;}});
      end.get(10,TimeUnit.SECONDS);var result=send.get(10,TimeUnit.SECONDS);var q=queues.findByCode(code).orElseThrow();
      if(result!=null)assertThat(result.createdAt()).isBeforeOrEqualTo(q.getChatEndedAt());assertThat(chat.customerRead(session,0).state()).isEqualTo("CLOSED");
    }finally{pool.shutdownNow();}
  }
  @Test void unrelatedSessionTenantAndRevokedPermissionCannotReadMessages()throws Exception{
    mvc.perform(get("/api/support/chat/messages").header("X-Support-Session","not-the-capability")).andExpect(status().isNotFound());
    mvc.perform(get("/api/chat/"+code+"/messages")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/chat/"+code+"/messages").header("X-Organization-ID",org+"-other").with(jwt().jwt(j->j.issuer(ISSUER).subject("agent")))).andExpect(status().isForbidden());
    mvc.perform(get("/api/support/chat/messages").header("X-Support-Session",session)).andExpect(jsonPath("$.messages[0].senderKey").doesNotExist()).andExpect(jsonPath("$.messages[0].queue").doesNotExist());
  }
  @Test void handoffMakesPreviousAgentReadOnlyAndNewAgentWritable(){
    var q=queues.findByCode(code).orElseThrow();q.handoff(actor("next"));queues.saveAndFlush(q);
    assertThatThrownBy(()->chat.staffSend(actor("agent"),code,UUID.randomUUID().toString(),"Old agent")).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    chat.staffSend(actor("next"),code,UUID.randomUUID().toString(),"New agent");
    var participant=new WorkspaceAccess.Actor(org,"agent","Agent",ISSUER,null,DataScope.SELF,Set.of(),Map.of("queue:read",DataScope.SELF),"queue:read",Set.of(),Set.of(code));
    assertThat(chat.staffRead(participant,code,0).canSend()).isFalse();
  }
  @Test void legacyTicketHasNoInventedTranscript(){
    var q=new QueueItem("old-"+UUID.randomUUID(),QueueItem.ItemType.TICKET,kr.shnea.hellow.customer.Customer.CustomerType.INDIVIDUAL,"Old",null,"010","","normal","Old one-time inquiry",false,false,false);q.setOrganizationId(org);q.assignOwner(actor("agent"));queues.save(q);
    assertThatThrownBy(()->chat.staffRead(actor("agent"),q.getCode(),0)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void expiryWorkerClosesAcceptedChatAndKeepsAfterworkAndTranscript(){
    var q=queues.findByCode(code).orElseThrow();
    ReflectionTestUtils.setField(q,"supportExpiresAt",Instant.now().minusSeconds(1));
    queues.saveAndFlush(q);
    assertThat(queues.expiredSupportWork(Instant.now())).extracting(QueueItem::getCode).contains(code);
    expiry.expire(org,code);
    var ended=queues.findByCode(code).orElseThrow();
    assertThat(ended.getChatEndedAt()).isNotNull();
    assertThat(ended.getStatus()).isEqualTo(QueueItem.QueueStatus.PROCESSING);
    assertThat(queues.expiredSupportWork(Instant.now())).extracting(QueueItem::getCode).doesNotContain(code);
    assertThat(chat.staffRead(actor("agent"),code,0).messages()).hasSize(1);
    assertThatThrownBy(()->chat.customerRead(session,0)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  }
  @Test void fullDisplayNameAndDistinctIdentityTuplesSurviveMessageDeduplication(){
    var name="닉".repeat(100)+"("+"i".repeat(255)+")";
    var first=new WorkspaceAccess.Actor(org,"agent:next",name,ISSUER,null,DataScope.ORGANIZATION,Set.of(),Map.of("queue:read",DataScope.ORGANIZATION,"queue:accept",DataScope.ORGANIZATION),"queue:read",Set.of(),Set.of());
    var second=new WorkspaceAccess.Actor(org,"next","Next",ISSUER+":agent",null,DataScope.ORGANIZATION,Set.of(),Map.of("queue:read",DataScope.ORGANIZATION,"queue:accept",DataScope.ORGANIZATION),"queue:read",Set.of(),Set.of());
    var firstOwner=new WorkspaceAccess.Actor(org,first.subject(),"First",first.issuer(),null,DataScope.ORGANIZATION,Set.of(),first.grants(),"queue:read",Set.of(),Set.of());
    var q=queues.findByCode(code).orElseThrow();q.handoff(firstOwner);queues.saveAndFlush(q);
    String id=UUID.randomUUID().toString();var sent=chat.staffSend(first,code,id,"First identity");
    assertThat(sent.senderName()).isEqualTo(name);
    q=queues.findByCode(code).orElseThrow();q.handoff(second);queues.saveAndFlush(q);
    var next=chat.staffSend(second,code,id,"Second identity");
    assertThat(next.sequence()).isEqualTo(sent.sequence()+1);
  }
  @Test void liveStreamReplaysCommittedRowsAndStopsAfterMembershipRevocation()throws Exception{
    var request=mvc.perform(get("/api/chat/"+code+"/events").header("X-Organization-ID",org).with(jwt().jwt(j->j.issuer(ISSUER).subject("agent")))).andExpect(request().asyncStarted()).andReturn();
    chat.customerSend(session,UUID.randomUUID().toString(),"Streaming reply");streams.deliver();
    assertThat(request.getResponse().getContentAsString()).contains("Streaming reply");
    members.deleteAll(members.findAll().stream().filter(m->org.equals(m.getOrganizationId())).toList());streams.deliver();
    assertThat(request.getResponse().getContentAsString()).contains("event:unavailable");
    mvc.perform(get("/api/chat/"+code+"/messages").header("X-Organization-ID",org).with(jwt().jwt(j->j.issuer(ISSUER).subject("agent")))).andExpect(status().isForbidden());
  }
}
