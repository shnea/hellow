package kr.shnea.hellow.platform;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/platform")
public class PlatformController {

    private final PlatformClient platformClient;
    private final PlatformProperties properties;

    public PlatformController(PlatformClient platformClient, PlatformProperties properties) {
        this.platformClient = platformClient;
        this.properties = properties;
    }

    /**
     * 플랫폼 연동 컨텍스트 상태 조회
     */
    @GetMapping("/context")
    public ResponseEntity<PlatformContext> getContext() {
        return ResponseEntity.ok(platformClient.fetchContext());
    }

    /**
     * OIDC 로그인 설정 정보 조회
     */
    @GetMapping("/oidc-config")
    public ResponseEntity<OidcConfigResponse> getOidcConfig() {
        return ResponseEntity.ok(new OidcConfigResponse(
                properties.getOidcIssuer(),
                properties.getOidcClientId(),
                properties.getOidcRedirectUri(),
                properties.getPostLogoutRedirectUri(),
                "openid profile email"
        ));
    }

    /**
     * 파일 업로드 (상담 첨부파일 / 스크린샷 등)
     */
    @PostMapping(value = "/files/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PlatformClient.FileUploadResult> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "visibility", defaultValue = "PUBLIC") String visibility) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            PlatformClient.FileUploadResult result = platformClient.uploadFile(
                    file.getOriginalFilename() != null ? file.getOriginalFilename() : "attached-file",
                    file.getBytes(),
                    visibility,
                    "default"
            );
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 파일 보기 티켓 발급
     */
    @GetMapping("/files/{fileId}/ticket")
    public ResponseEntity<Map<String, Object>> getViewTicket(@PathVariable String fileId) {
        return ResponseEntity.ok(platformClient.getViewTicket(fileId));
    }

    public record OidcConfigResponse(
            String issuer,
            String clientId,
            String redirectUri,
            String postLogoutRedirectUri,
            String scopes
    ) {}
}
