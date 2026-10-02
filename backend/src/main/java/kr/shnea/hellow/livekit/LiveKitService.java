package kr.shnea.hellow.livekit;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;

@Service
public class LiveKitService {

    @Value("${livekit.api-key:devkey}")
    private String apiKey;

    @Value("${livekit.api-secret:secret}")
    private String apiSecret;

    @Value("${livekit.url:ws://localhost:30162}")
    private String liveKitUrl;

    public LiveKitTokenResponse createToken(String roomName, String identity, String participantName, boolean isAgent) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(6, ChronoUnit.HOURS);
        Instant notBefore = now.minus(10, ChronoUnit.SECONDS);

        Map<String, Object> videoGrants = new HashMap<>();
        videoGrants.put("room", roomName);
        videoGrants.put("roomJoin", true);
        videoGrants.put("canPublish", true);
        videoGrants.put("canSubscribe", true);
        videoGrants.put("canPublishData", true);
        if (isAgent) {
            videoGrants.put("roomAdmin", true);
        }

        Algorithm algorithm = Algorithm.HMAC256(apiSecret);
        String token = JWT.create()
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

    public record LiveKitTokenResponse(
            String token,
            String url,
            String roomName,
            String identity,
            String participantName
    ) {}
}
