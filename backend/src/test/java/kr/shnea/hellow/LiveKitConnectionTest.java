package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import kr.shnea.hellow.livekit.LiveKitService;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;

class LiveKitConnectionTest {
  HttpServer server;LiveKitService media;String reply;int status;String authorization,request;
  @BeforeEach void start()throws Exception{
    status=200;server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
    server.createContext("/twirp/livekit.RoomService/GetParticipant",exchange->{authorization=exchange.getRequestHeaders().getFirst("Authorization");request=new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8);byte[] body=reply.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(status,body.length);exchange.getResponseBody().write(body);exchange.close();});server.start();
    media=new LiveKitService();ReflectionTestUtils.setField(media,"apiKey","test-key");ReflectionTestUtils.setField(media,"apiSecret","test-secret");ReflectionTestUtils.setField(media,"internalUrl","http://127.0.0.1:"+server.getAddress().getPort());
  }
  @AfterEach void stop(){server.stop(0);}
  @Test void onlyActiveCorrectIdentityWithMicrophoneCountsAndProviderUsesScopedAdminToken()throws Exception{
    reply="{\"identity\":\"transfer-one\",\"sid\":\"PA-one\",\"state\":\"ACTIVE\",\"tracks\":[{\"type\":\"AUDIO\",\"source\":\"MICROPHONE\"}]}";
    assertThat(media.participantConnection("org-call","transfer-one")).isEqualTo(new LiveKitService.ParticipantConnection(true,true,"PA-one"));
    var token=JWT.require(Algorithm.HMAC256("test-secret")).withIssuer("test-key").build().verify(authorization.substring(7));assertThat(token.getClaim("video").asMap()).containsEntry("room","org-call").containsEntry("roomAdmin",true).doesNotContainKey("roomJoin");
    var input=new ObjectMapper().readTree(request);assertThat(input.path("room").asText()).isEqualTo("org-call");assertThat(input.path("identity").asText()).isEqualTo("transfer-one");
    reply="{\"identity\":\"transfer-one\",\"sid\":\"PA-one\",\"state\":2,\"tracks\":[{\"source\":2}]}";assertThat(media.participantConnection("org-call","transfer-one").microphonePublished()).isTrue();
    reply="{\"identity\":\"transfer-one\",\"sid\":\"PA-one\",\"state\":\"JOINED\",\"tracks\":[{\"source\":\"MICROPHONE\"}]}";assertThat(media.participantConnection("org-call","transfer-one").active()).isFalse();
    reply="{\"identity\":\"transfer-one\",\"sid\":\"PA-one\",\"state\":\"ACTIVE\",\"tracks\":[{\"type\":\"VIDEO\",\"source\":\"CAMERA\"}]}";assertThat(media.participantConnection("org-call","transfer-one").microphonePublished()).isFalse();
  }
  @Test void missingParticipantWrongIdentityAndProviderOutageFailClosed(){
    reply="{\"identity\":\"someone-else\",\"sid\":\"PA-one\",\"state\":\"ACTIVE\"}";assertThat(media.participantConnection("org-call","transfer-one").active()).isFalse();
    status=404;reply="{\"code\":\"not_found\",\"msg\":\"not connected\"}";assertThat(media.participantConnection("org-call","transfer-one").active()).isFalse();
    status=500;reply="{\"code\":\"internal\",\"msg\":\"temporarily unavailable\"}";assertThatThrownBy(()->media.participantConnection("org-call","transfer-one")).isInstanceOf(org.springframework.web.client.HttpServerErrorException.class);
  }
}
