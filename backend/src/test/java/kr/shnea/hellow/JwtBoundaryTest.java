package kr.shnea.hellow;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.security.*;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.*;
import kr.shnea.hellow.platform.PlatformProperties;
import kr.shnea.hellow.security.SecurityConfiguration;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.*;

class JwtBoundaryTest {
  HttpServer server;
  RSAKey key;
  JwtDecoder decoder;
  String issuer;

  @BeforeEach
  void setup() throws Exception {
    var generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    var pair = generator.generateKeyPair();
    key =
        new RSAKey.Builder((RSAPublicKey) pair.getPublic())
            .privateKey((RSAPrivateKey) pair.getPrivate())
            .keyID("test-key")
            .build();
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    byte[] jwks =
        new JWKSet(key.toPublicJWK()).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    server.createContext(
        "/protocol/openid-connect/certs",
        exchange -> {
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, jwks.length);
          exchange.getResponseBody().write(jwks);
          exchange.close();
        });
    server.start();
    issuer = "http://127.0.0.1:" + server.getAddress().getPort();
    var properties = mock(PlatformProperties.class);
    when(properties.getOidcIssuer()).thenReturn(issuer);
    when(properties.getOidcClientId()).thenReturn("app");
    decoder = new SecurityConfiguration().jwtDecoder(properties);
  }

  @AfterEach
  void stop() {
    server.stop(0);
  }

  String token(String tokenIssuer, String audience, Instant expiry, RSAKey signingKey)
      throws Exception {
    return token(tokenIssuer, audience, expiry, signingKey, "app", "Bearer");
  }

  String token(
      String tokenIssuer,
      String audience,
      Instant expiry,
      RSAKey signingKey,
      String authorizedClient,
      String tokenType)
      throws Exception {
    var claims =
        new JWTClaimsSet.Builder()
            .subject("alice")
            .issuer(tokenIssuer)
            .audience(audience)
            .issueTime(new Date())
            .expirationTime(Date.from(expiry));
    if (authorizedClient != null) claims.claim("azp", authorizedClient);
    if (tokenType != null) claims.claim("typ", tokenType);
    var signed =
        new SignedJWT(
            new JWSHeader.Builder(JWSAlgorithm.RS256)
                .keyID("test-key")
                .type(JOSEObjectType.JWT)
                .build(),
            claims.build());
    signed.sign(new RSASSASigner(signingKey));
    return signed.serialize();
  }

  @Test
  void verifiesPlatformAccessTokenAndRejectsOtherTokens() throws Exception {
    assertThat(
            decoder
                .decode(token(issuer, "account", Instant.now().plusSeconds(60), key))
                .getSubject())
        .isEqualTo("alice");
    for (String value :
        List.of(
            token("https://wrong.example", "account", Instant.now().plusSeconds(60), key),
            token(issuer, "app", Instant.now().plusSeconds(60), key),
            token(issuer, "account", Instant.now().plusSeconds(60), key, "other-app", "Bearer"),
            token(issuer, "account", Instant.now().plusSeconds(60), key, null, "Bearer"),
            token(issuer, "account", Instant.now().plusSeconds(60), key, "app", "ID"),
            token(issuer, "account", Instant.now().minusSeconds(120), key)))
      assertThatThrownBy(() -> decoder.decode(value)).isInstanceOf(JwtException.class);
    var generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    var pair = generator.generateKeyPair();
    var forged =
        new RSAKey.Builder((RSAPublicKey) pair.getPublic())
            .privateKey((RSAPrivateKey) pair.getPrivate())
            .build();
    String value = token(issuer, "account", Instant.now().plusSeconds(60), forged);
    assertThatThrownBy(() -> decoder.decode(value)).isInstanceOf(JwtException.class);
  }

  @Test
  void configuredApiAudienceRemainsStrict() throws Exception {
    var properties = mock(PlatformProperties.class);
    when(properties.getOidcIssuer()).thenReturn(issuer);
    when(properties.getOidcClientId()).thenReturn("app");
    when(properties.getApiAudience()).thenReturn("hellow-api");
    var strictDecoder = new SecurityConfiguration().jwtDecoder(properties);
    assertThatThrownBy(
            () -> strictDecoder.decode(token(issuer, "account", Instant.now().plusSeconds(60), key)))
        .isInstanceOf(JwtException.class);
    assertThat(
            strictDecoder
                .decode(token(issuer, "hellow-api", Instant.now().plusSeconds(60), key))
                .getSubject())
        .isEqualTo("alice");
  }

  @Test
  void unconfiguredClientFailsClosed() {
    var properties = mock(PlatformProperties.class);
    when(properties.getOidcIssuer()).thenReturn(issuer);
    when(properties.getOidcClientId()).thenReturn("");
    assertThatThrownBy(() -> new SecurityConfiguration().jwtDecoder(properties).decode("anything"))
        .isInstanceOf(BadJwtException.class);
  }
}
