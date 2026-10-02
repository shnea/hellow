package kr.shnea.hellow.security;

import kr.shnea.hellow.platform.PlatformProperties;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfiguration {
  @Bean
  public JwtDecoder jwtDecoder(PlatformProperties properties) {
    String issuer = properties.getOidcIssuer();
    String apiAudience = properties.getApiAudience();
    if (issuer == null || issuer.isBlank() || apiAudience == null || apiAudience.isBlank())
      return token -> {
        throw new BadJwtException("OIDC API configuration is missing");
      };
    var decoder = NimbusJwtDecoder.withJwkSetUri(issuer + "/protocol/openid-connect/certs").build();
    var audience =
        new JwtClaimValidator<java.util.List<String>>(
            "aud",
            values ->
                !apiAudience.equals(properties.getOidcClientId())
                    && values != null
                    && values.contains(apiAudience));
    decoder.setJwtValidator(
        new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer(issuer), audience));
    return decoder;
  }

  @Bean
  SecurityFilterChain apiSecurity(HttpSecurity http, JwtDecoder decoder) throws Exception {
    return http.csrf(
            csrf -> csrf.disable()) // Stateless Authorization header; no cookie authentication.
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(
                        "/actuator/health", "/api/platform/oidc-config", "/api/support/**")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.decoder(decoder)))
        .build();
  }
}
