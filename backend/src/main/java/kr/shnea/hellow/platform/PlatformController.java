package kr.shnea.hellow.platform;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/platform")
public class PlatformController {
  private final PlatformProperties properties;

  public PlatformController(PlatformProperties properties) {
    this.properties = properties;
  }

  @GetMapping("/oidc-config")
  public OidcConfigResponse config() {
    return new OidcConfigResponse(
        properties.getOidcIssuer(),
        properties.getOidcClientId(),
        properties.getOidcRedirectUri(),
        properties.getPostLogoutRedirectUri(),
        "openid profile email");
  }

  public record OidcConfigResponse(
      String issuer,
      String clientId,
      String redirectUri,
      String postLogoutRedirectUri,
      String scopes) {}
}
