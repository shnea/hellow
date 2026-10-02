package kr.shnea.hellow.platform;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PlatformProperties {

    @Value("${platform.api-url:https://platform.shnea.kr}")
    private String apiUrl;

    @Value("${platform.api-key:}")
    private String apiKey;

    @Value("${platform.project-id:}")
    private String projectId;

    @Value("${platform.environment-id:}")
    private String environmentId;

    @Value("${platform.oidc-issuer:}")
    private String oidcIssuer;

    @Value("${platform.oidc-client-id:app}")
    private String oidcClientId;

    @Value("${platform.oidc-redirect-uri:https://dev-hellow.shnea.kr/auth/callback}")
    private String oidcRedirectUri;

    @Value("${platform.post-logout-redirect-uri:https://dev-hellow.shnea.kr/}")
    private String postLogoutRedirectUri;

    public String getApiUrl() { return apiUrl; }
    public String getApiKey() { return apiKey; }
    public String getProjectId() { return projectId; }
    public String getEnvironmentId() { return environmentId; }
    public String getOidcIssuer() { return oidcIssuer; }
    public String getOidcClientId() { return oidcClientId; }
    public String getOidcRedirectUri() { return oidcRedirectUri; }
    public String getPostLogoutRedirectUri() { return postLogoutRedirectUri; }

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}
