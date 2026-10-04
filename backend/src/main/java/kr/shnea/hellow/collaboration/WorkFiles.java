package kr.shnea.hellow.collaboration;

import static org.springframework.http.HttpStatus.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.*;
import kr.shnea.hellow.platform.*;
import kr.shnea.hellow.security.WorkspaceAccess;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Called only after the owning document/room has been authorized and locked. */
@Service
public class WorkFiles {
  public record View(String id, String name, String mime, long size) {}

  private final WorkFileRepository files;
  private final PlatformClient platform;
  private final PlatformProperties config;
  private final Clock clock;

  public WorkFiles(
      WorkFileRepository files, PlatformClient platform, PlatformProperties config, Clock clock) {
    this.files = files;
    this.platform = platform;
    this.config = config;
    this.clock = clock;
  }

  public WorkFile get(String org, String kind, String owner, String id) {
    return files
        .findByOrganizationIdAndOwnerKindAndOwnerIdAndId(org, kind, owner, id)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "첨부파일을 찾을 수 없습니다."));
  }

  public View view(WorkFile f) {
    return new View(f.id, f.name, f.mime, f.size);
  }

  public WorkFile upload(
      WorkspaceAccess.Actor a, String kind, String owner, String request, MultipartFile file)
      throws java.io.IOException {
    try {
      request = UUID.fromString(request).toString();
    } catch (Exception e) {
      throw new ResponseStatusException(BAD_REQUEST, "파일 전송 ID를 확인해 주세요.");
    }
    if (file.isEmpty() || file.getSize() > 50L * 1024 * 1024)
      throw new ResponseStatusException(BAD_REQUEST, "첨부파일은 최대50MB까지 선택해 주세요.");
    String original =
        Optional.ofNullable(file.getOriginalFilename()).orElse("file").replace('\\', '/');
    String name =
        original.substring(original.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").strip();
    if (name.isBlank() || name.length() > 180)
      throw new ResponseStatusException(BAD_REQUEST, "파일 이름은1~180자여야 합니다.");
    String mime = Optional.ofNullable(file.getContentType()).orElse("application/octet-stream");
    if (mime.length() > 120 || mime.contains("\r") || mime.contains("\n"))
      throw new ResponseStatusException(BAD_REQUEST, "파일 형식이 올바르지 않습니다.");
    String sha;
    try (var in = file.getInputStream()) {
      var digest = MessageDigest.getInstance("SHA-256");
      byte[] buffer = new byte[65536];
      int n;
      while ((n = in.read(buffer)) != -1) digest.update(buffer, 0, n);
      sha = HexFormat.of().formatHex(digest.digest());
    } catch (java.security.NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
    var old =
        files
            .findByOrganizationIdAndOwnerKindAndOwnerIdAndUploaderIssuerAndUploaderSubjectAndRequestId(
                a.organizationId(), kind, owner, a.issuer(), a.subject(), request);
    if (old.isPresent()) {
      var f = old.get();
      if (!f.sha256.equals(sha)
          || f.size != file.getSize()
          || !f.name.equals(name)
          || !f.mime.equals(mime))
        throw new ResponseStatusException(CONFLICT, "같은 전송 ID의 파일이 변경되었습니다.");
      return f;
    }
    if (!config.isConfigured() || config.getAttachmentRetentionCode().isBlank())
      throw new ResponseStatusException(SERVICE_UNAVAILABLE, "첨부파일 저장 서비스를 설정해 주세요.");
    String key =
        UUID.nameUUIDFromBytes(
                ("work-file:"
                        + a.organizationId()
                        + ":"
                        + kind
                        + ":"
                        + owner
                        + ":"
                        + a.issuer()
                        + ":"
                        + a.subject()
                        + ":"
                        + request)
                    .getBytes(StandardCharsets.UTF_8))
            .toString();
    var result = platform.uploadFile(file, key);
    if (result.size() != file.getSize() || !result.sha256().equals(sha))
      throw new ResponseStatusException(BAD_GATEWAY, "저장된 파일 확인에 실패했습니다. 같은 파일로 다시 시도해 주세요.");
    var f = new WorkFile();
    f.id = UUID.randomUUID().toString();
    f.organizationId = a.organizationId();
    f.ownerKind = kind;
    f.ownerId = owner;
    f.uploaderIssuer = a.issuer();
    f.uploaderSubject = a.subject();
    f.requestId = request;
    f.platformFileId = result.fileId();
    f.name = name;
    f.mime = mime;
    f.size = result.size();
    f.sha256 = sha;
    f.createdAt = clock.instant();
    return files.saveAndFlush(f);
  }

  public Map<String, Object> ticket(WorkFile f) {
    try {
      var raw = platform.getViewTicket(f.platformFileId);
      var safe = new LinkedHashMap<String, Object>();
      for (String key : List.of("originalUrl", "previewUrl", "thumbnailUrl"))
        if (raw.get(key) instanceof String url && url.matches("https?://.+")) safe.put(key, url);
      if (safe.isEmpty()) throw new IllegalStateException();
      return safe;
    } catch (Exception e) {
      throw new ResponseStatusException(BAD_GATEWAY, "파일을 불러오지 못했습니다. 다시 시도해 주세요.");
    }
  }
}
