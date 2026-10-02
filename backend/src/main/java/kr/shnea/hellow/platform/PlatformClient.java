package kr.shnea.hellow.platform;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;

@Service
public class PlatformClient {

    private static final Logger log = LoggerFactory.getLogger(PlatformClient.class);
    private static final int CHUNK_SIZE = 8 * 1024 * 1024; // 8MB

    private final PlatformProperties properties;
    private final RestClient restClient;

    public PlatformClient(PlatformProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder()
                .baseUrl(properties.getApiUrl())
                .build();
    }

    /**
     * 플랫폼 컨텍스트 검증 (GET /api/v1/integration/context)
     */
    public PlatformContext fetchContext() {
        if (!properties.isConfigured()) {
            return PlatformContext.unconfigured("PLATFORM_API_KEY 환경변수가 설정되지 않았습니다.");
        }

        try {
            RawContextResponse raw = restClient.get()
                    .uri("/api/v1/integration/context")
                    .header("X-Platform-Key", properties.getApiKey())
                    .retrieve()
                    .body(RawContextResponse.class);

            if (raw == null) {
                return PlatformContext.unconfigured("플랫폼 응답이 비어 있습니다.");
            }

            boolean projectMatches = Objects.equals(properties.getProjectId(), raw.projectId());
            boolean envMatches = Objects.equals(properties.getEnvironmentId(), raw.environmentId());
            boolean verified = projectMatches && envMatches;

            String statusMessage = verified ?
                    "SHNEA 플랫폼 연동 정상 (프로젝트/환경 일치)" :
                    String.format("환경 불일치 경고 (설정: %s / 수신: %s)", properties.getEnvironmentId(), raw.environmentId());

            return new PlatformContext(
                    raw.projectId(),
                    raw.environmentId(),
                    raw.kind(),
                    raw.issuer(),
                    raw.scopes() != null ? raw.scopes() : List.of(),
                    verified,
                    statusMessage
            );
        } catch (Exception e) {
            log.error("Failed to fetch platform context", e);
            return PlatformContext.unconfigured("플랫폼 API 통신 실패: " + e.getMessage());
        }
    }

    /**
     * 파일 업로드 (POST /api/v1/files/uploads -> PATCH chunks -> POST /complete)
     */
    public FileUploadResult uploadFile(String originalName, byte[] content, String visibility, String retentionCode) {
        if (!properties.isConfigured()) {
            throw new IllegalStateException("PLATFORM_API_KEY가 설정되지 않아 플랫폼 파일 업로드를 수행할 수 없습니다.");
        }

        String sha256Hex = calculateSha256(content);
        long size = content.length;
        String requestId = UUID.randomUUID().toString();
        String vis = (visibility != null && !visibility.isBlank()) ? visibility : "PUBLIC";
        String ret = (retentionCode != null && !retentionCode.isBlank()) ? retentionCode : "default";

        try {
            // 1. 업로드 세션 생성
            Map<String, Object> createReq = Map.of(
                    "requestId", requestId,
                    "originalName", originalName,
                    "size", size,
                    "sha256", sha256Hex,
                    "visibility", vis,
                    "retentionCode", ret
            );

            UploadSession session = restClient.post()
                    .uri("/api/v1/files/uploads")
                    .header("X-Platform-Key", properties.getApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(createReq)
                    .retrieve()
                    .body(UploadSession.class);

            if (session == null || session.uploadId() == null) {
                throw new IllegalStateException("업로드 세션 생성 실패 (null 응답)");
            }

            String uploadId = session.uploadId();

            // 2. 청크 업로드 (PATCH /api/v1/files/uploads/{id})
            int offset = 0;
            while (offset < size) {
                int currentChunkSize = (int) Math.min(CHUNK_SIZE, size - offset);
                byte[] chunk = Arrays.copyOfRange(content, offset, offset + currentChunkSize);
                String chunkSha256 = calculateSha256(chunk);

                restClient.patch()
                        .uri("/api/v1/files/uploads/" + uploadId)
                        .header("X-Platform-Key", properties.getApiKey())
                        .header("Upload-Offset", String.valueOf(offset))
                        .header("X-Chunk-SHA256", chunkSha256)
                        .contentType(MediaType.APPLICATION_OCTET_STREAM)
                        .body(chunk)
                        .retrieve()
                        .toBodilessEntity();

                offset += currentChunkSize;
            }

            // 3. 완료 요청 (POST /api/v1/files/uploads/{id}/complete)
            UploadCompleteResponse completed = restClient.post()
                    .uri("/api/v1/files/uploads/" + uploadId + "/complete")
                    .header("X-Platform-Key", properties.getApiKey())
                    .retrieve()
                    .body(UploadCompleteResponse.class);

            String fileId = completed != null ? completed.fileId() : null;
            if (fileId == null) {
                throw new IllegalStateException("업로드 완료 응답에 fileId가 누락되었습니다.");
            }

            String viewUrl = properties.getApiUrl() + "/api/v1/files/" + fileId + "/content/original";

            return new FileUploadResult(fileId, originalName, size, sha256Hex, viewUrl, "COMPLETED");
        } catch (Exception e) {
            log.error("Failed to upload file to SHNEA platform", e);
            throw new RuntimeException("플랫폼 파일 업로드 실패: " + e.getMessage(), e);
        }
    }

    /**
     * 파일 보기 티켓 발급
     */
    public Map<String, Object> getViewTicket(String fileId) {
        return restClient.post()
                .uri("/api/v1/files/" + fileId + "/view-ticket")
                .header("X-Platform-Key", properties.getApiKey())
                .retrieve()
                .body(Map.class);
    }

    private String calculateSha256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    private record RawContextResponse(
            String projectId,
            String environmentId,
            String kind,
            String issuer,
            List<String> scopes
    ) {}

    private record UploadSession(
            String uploadId,
            String state,
            Long size,
            Long receivedBytes,
            String fileId
    ) {}

    private record UploadCompleteResponse(
            String uploadId,
            String state,
            String fileId
    ) {}

    public record FileUploadResult(
            String fileId,
            String originalName,
            long size,
            String sha256,
            String viewUrl,
            String status
    ) {}
}
