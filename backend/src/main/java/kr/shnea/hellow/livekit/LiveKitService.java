package kr.shnea.hellow.livekit;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class LiveKitService {

  @Value("${livekit.api-key:devkey}")
  private String apiKey;

  @Value("${livekit.api-secret:secret}")
  private String apiSecret;

  @Value("${livekit.url:ws://localhost:30162}")
  private String liveKitUrl;

  @Value("${livekit.internal-url:http://livekit:7880}")
  private String internalUrl;

  public void removeParticipant(String room, String identity) {
    Instant now = Instant.now();
    String token =
        JWT.create()
            .withIssuer(apiKey)
            .withClaim("video", Map.of("room", room, "roomAdmin", true))
            .withIssuedAt(now)
            .withExpiresAt(now.plusSeconds(60))
            .sign(Algorithm.HMAC256(apiSecret));
    var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(2000);
    factory.setReadTimeout(2000);
    try {
      org.springframework.web.client.RestClient.builder()
          .requestFactory(factory)
          .baseUrl(internalUrl)
          .build()
          .post()
          .uri("/twirp/livekit.RoomService/RemoveParticipant")
          .header("Authorization", "Bearer " + token)
          .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
          .body(Map.of("room", room, "identity", identity))
          .retrieve()
          .toBodilessEntity();
    } catch (org.springframework.web.client.HttpClientErrorException.NotFound ignored) {
      // Removing a participant that already left is idempotent.
    }
  }

  public LiveKitTokenResponse createToken(
      String roomName, String identity, String participantName, boolean isAgent) {
    Instant now = Instant.now();
    Instant expiresAt = now.plus(2, ChronoUnit.MINUTES);
    Instant notBefore = now.minus(10, ChronoUnit.SECONDS);

    Map<String, Object> videoGrants = new HashMap<>();
    videoGrants.put("room", roomName);
    videoGrants.put("roomJoin", true);
    videoGrants.put("canPublish", true);
    videoGrants.put("canSubscribe", true);
    videoGrants.put("canPublishData", false);
    videoGrants.put("canPublishSources", java.util.List.of("microphone"));

    Algorithm algorithm = Algorithm.HMAC256(apiSecret);
    String token =
        JWT.create()
            .withIssuer(apiKey)
            .withSubject(identity)
            .withClaim("name", participantName != null ? participantName : identity)
            .withClaim("video", videoGrants)
            .withIssuedAt(now)
            .withNotBefore(notBefore)
            .withExpiresAt(expiresAt)
            .sign(algorithm);

    return new LiveKitTokenResponse(token, liveKitUrl, roomName, identity, participantName);
  }

  public String getLiveKitUrl() {
    return liveKitUrl;
  }

  public record ParticipantConnection(boolean active,boolean microphonePublished,String sid) {}

  /** Server evidence: ICE is ACTIVE; a joining socket alone is not a connected call. */
  public ParticipantConnection participantConnection(String room,String identity) {
    Instant now=Instant.now();
    String token=JWT.create().withIssuer(apiKey).withClaim("video",Map.of("room",room,"roomAdmin",true))
        .withIssuedAt(now).withExpiresAt(now.plusSeconds(60)).sign(Algorithm.HMAC256(apiSecret));
    var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();factory.setConnectTimeout(2000);factory.setReadTimeout(2000);
    try {
      var info=org.springframework.web.client.RestClient.builder().requestFactory(factory).baseUrl(internalUrl).build().post()
          .uri("/twirp/livekit.RoomService/GetParticipant").header("Authorization","Bearer "+token)
          .contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(Map.of("room",room,"identity",identity))
          .retrieve().body(com.fasterxml.jackson.databind.JsonNode.class);
      if(info==null||!identity.equals(info.path("identity").asText()))return new ParticipantConnection(false,false,null);
      var state=info.path("state");boolean active="ACTIVE".equals(state.asText())||state.isInt()&&state.asInt()==2;
      boolean microphone=false;
      for(var track:info.path("tracks")) {
        var source=track.path("source");var type=track.path("type");
        boolean audio=type.isMissingNode()||"AUDIO".equals(type.asText())||type.isInt()&&type.asInt()==0;
        if(audio&&("MICROPHONE".equals(source.asText())||source.isInt()&&source.asInt()==2))microphone=true;
      }
      String sid=info.path("sid").asText();
      return new ParticipantConnection(active&&!sid.isBlank(),microphone,sid);
    } catch(org.springframework.web.client.HttpClientErrorException.NotFound absent) {
      return new ParticipantConnection(false,false,null);
    }
  }

  public record LiveKitTokenResponse(
      String token, String url, String roomName, String identity, String participantName) {}
}
