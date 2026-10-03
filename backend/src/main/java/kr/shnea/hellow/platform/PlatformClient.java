package kr.shnea.hellow.platform;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class PlatformClient {

  private static final Logger log = LoggerFactory.getLogger(PlatformClient.class);
  private static final int CHUNK_SIZE = 8 * 1024 * 1024; // 8MB

  private final PlatformProperties properties;
  private final RestClient restClient;

  public PlatformClient(PlatformProperties properties) {
    this.properties = properties;
    var http =
        java.net.http.HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(5))
            .build();
    var factory = new org.springframework.http.client.JdkClientHttpRequestFactory(http);
    factory.setReadTimeout(java.time.Duration.ofSeconds(30));
    this.restClient =
        RestClient.builder().requestFactory(factory).baseUrl(properties.getApiUrl()).build();
  }

  /** 플랫폼 컨텍스트 검증 (GET /api/v1/integration/context) */
  public PlatformContext fetchContext() {
    if (!properties.isConfigured()) {
      return PlatformContext.unconfigured("PLATFORM_API_KEY 환경변수가 설정되지 않았습니다.");
    }

    try {
      RawContextResponse raw =
          restClient
              .get()
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

      String statusMessage =
          verified
              ? "SHNEA 플랫폼 연동 정상 (프로젝트/환경 일치)"
              : String.format(
                  "환경 불일치 경고 (설정: %s / 수신: %s)",
                  properties.getEnvironmentId(), raw.environmentId());

      return new PlatformContext(
          raw.projectId(),
          raw.environmentId(),
          raw.kind(),
          raw.issuer(),
          raw.scopes() != null ? raw.scopes() : List.of(),
          verified,
          statusMessage);
    } catch (Exception e) {
      log.error("Failed to fetch platform context", e);
      return PlatformContext.unconfigured("플랫폼 API 통신 실패: " + e.getMessage());
    }
  }

  /** 파일 업로드 (POST /api/v1/files/uploads -> PATCH chunks -> POST /complete) */
  public FileUploadResult uploadFile(
      org.springframework.web.multipart.MultipartFile file, String requestId)
      throws java.io.IOException {
    return uploadFile(file, file.getOriginalFilename() == null ? "attachment" : file.getOriginalFilename(),
        file.getSize(), requestId);
  }

  /** 녹음 파일도 전체 내용을 메모리에 올리지 않고 같은 재개 가능한 업로드를 사용한다. */
  public FileUploadResult uploadFile(java.nio.file.Path file, String requestId)
      throws java.io.IOException {
    return uploadFile(new org.springframework.core.io.FileSystemResource(file),
        file.getFileName().toString(), java.nio.file.Files.size(file), requestId);
  }

  private FileUploadResult uploadFile(org.springframework.core.io.InputStreamSource file,
      String originalName, long size, String requestId) throws java.io.IOException {
    if (!properties.isConfigured()) {
      throw new IllegalStateException("PLATFORM_API_KEY가 설정되지 않아 플랫폼 파일 업로드를 수행할 수 없습니다.");
    }

    String sha256Hex;
    try (var input = file.getInputStream()) {
      var digest = java.security.MessageDigest.getInstance("SHA-256");
      byte[] buffer = new byte[64 * 1024];
      int count;
      while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
      sha256Hex = java.util.HexFormat.of().formatHex(digest.digest());
    } catch (java.security.NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
    String vis = "PRIVATE";
    String ret = properties.getAttachmentRetentionCode();

    try {
      // 1. 업로드 세션 생성
      Map<String, Object> createReq =
          Map.of(
              "requestId", requestId,
              "originalName", originalName,
              "size", size,
              "sha256", sha256Hex,
              "visibility", vis,
              "retentionCode", ret);

      UploadSession session =
          restClient
              .post()
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
      if (session.size() != null && session.size() != size)
        throw new IllegalStateException("업로드 세션의 파일 크기가 다릅니다.");
      if ("READY".equals(session.state())) {
        if (session.fileId() == null || session.fileId().isBlank())
          throw new IllegalStateException("완료된 업로드의 fileId가 없습니다.");
        return uploadedFile(session.fileId(), originalName, size, sha256Hex);
      }
      if (session.state() != null && !"UPLOADING".equals(session.state()))
        throw new IllegalStateException("다시 사용할 수 없는 업로드 세션입니다.");

      // 2. 청크 업로드 (PATCH /api/v1/files/uploads/{id})
      long offset = session.receivedBytes() == null ? 0 : session.receivedBytes();
      if (offset < 0 || offset > size)
        throw new IllegalStateException("업로드 재개 위치가 파일 범위를 벗어났습니다.");
      try (var input = file.getInputStream()) {
        input.skipNBytes(offset);
        while (offset < size) {
          byte[] chunk = input.readNBytes((int) Math.min(CHUNK_SIZE, size - offset));
          int currentChunkSize = chunk.length;
          if (currentChunkSize == 0) throw new java.io.IOException("Unexpected upload EOF");
          String chunkSha256 = calculateSha256(chunk);

          restClient
              .patch()
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
      }

      // 3. 완료 요청 (POST /api/v1/files/uploads/{id}/complete)
      UploadCompleteResponse completed =
          restClient
              .post()
              .uri("/api/v1/files/uploads/" + uploadId + "/complete")
              .header("X-Platform-Key", properties.getApiKey())
              .retrieve()
              .body(UploadCompleteResponse.class);

      String fileId = completed != null ? completed.fileId() : null;
      if (fileId == null || fileId.isBlank()) {
        throw new IllegalStateException("업로드 완료 응답에 fileId가 누락되었습니다.");
      }

      return uploadedFile(fileId, originalName, size, sha256Hex);
    } catch (Exception e) {
      log.warn("Platform file upload failed: {}", e.getClass().getSimpleName());
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.BAD_GATEWAY,
          "첨부파일 업로드에 실패했습니다. 입력을 보존하고 다시 시도해 주세요.");
    }
  }

  private FileUploadResult uploadedFile(String fileId, String name, long size, String sha256) {
    return new FileUploadResult(fileId, name, size, sha256,
        properties.getApiUrl() + "/api/v1/files/" + fileId + "/content/original", "COMPLETED");
  }

  /** 파일 보기 티켓 발급 */
  public Map<String, Object> getViewTicket(String fileId) {
    Map<String, Object> ticket = restClient
        .post()
        .uri("/api/v1/files/" + fileId + "/view-ticket")
        .header("X-Platform-Key", properties.getApiKey())
        .retrieve()
        .body(Map.class);
    if (ticket == null) throw new IllegalStateException("파일 재생 응답이 비어 있습니다.");
    var result = new LinkedHashMap<>(ticket);
    // Platform capabilities may be relative to its own origin, never the CRM origin.
    var origin = java.net.URI.create(properties.getApiUrl());
    for (String key : List.of("originalUrl", "previewUrl", "thumbnailUrl", "downloadUrl", "viewerUrl", "streamUrl", "shareUrl")) {
      if (result.get(key) instanceof String url && !url.isBlank()) {
        result.put(key, origin.resolve(url).toString());
      }
    }
    return result;
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
      String projectId, String environmentId, String kind, String issuer, List<String> scopes) {}

  private record UploadSession(
      String uploadId, String state, Long size, Long receivedBytes, String fileId) {}

  private record UploadCompleteResponse(String uploadId, String state, String fileId) {}

  public record FileUploadResult(
      String fileId,
      String originalName,
      long size,
      String sha256,
      String viewUrl,
      String status) {}
}
