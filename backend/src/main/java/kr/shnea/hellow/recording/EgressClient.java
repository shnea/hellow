package kr.shnea.hellow.recording;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
/** LiveKit 1.13.5+ unified audio-only egress contract. */
@Component
public class EgressClient {
  private final RestClient http;private final String key,secret;
  public EgressClient(@Value("${livekit.internal-url:http://livekit:7880}")String url,@Value("${livekit.api-key:devkey}")String key,@Value("${livekit.api-secret:secret}")String secret){
    this.key=key;this.secret=secret;var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();factory.setConnectTimeout(3000);factory.setReadTimeout(15000);http=RestClient.builder().baseUrl(url).requestFactory(factory).build();
  }
  public JsonNode list(String room){return call("ListEgress",Map.of("room_name",room)).path("items");}
  public JsonNode start(String room,String path){return call("StartEgress",Map.of("room_name",room,"template",Map.of("audio_only",true),"outputs",List.of(Map.of("file",Map.of("file_type","OGG","filepath",path,"disable_manifest",true)))));}
  public JsonNode stop(String id){return call("StopEgress",Map.of("egress_id",id));}
  private JsonNode call(String method,Map<String,Object> body){var now=Instant.now();String token=JWT.create().withIssuer(key).withClaim("video",Map.of("roomRecord",true)).withIssuedAt(now).withExpiresAt(now.plusSeconds(60)).sign(Algorithm.HMAC256(secret));
    return http.post().uri("/twirp/livekit.Egress/"+method).header("Authorization","Bearer "+token).contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode.class);
  }
}
