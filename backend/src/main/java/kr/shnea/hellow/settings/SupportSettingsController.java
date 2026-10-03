package kr.shnea.hellow.settings;
import static org.springframework.http.HttpStatus.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import kr.shnea.hellow.security.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/admin/settings")
public class SupportSettingsController {
  private final AdminAccess admin;
  private final OrganizationRepository organizations;
  private final SupportSettingsRepository settings;
  private final SupportSettingsService service;
  private final AuditEvents audit;
  public SupportSettingsController(AdminAccess admin, OrganizationRepository organizations, SupportSettingsRepository settings,
      SupportSettingsService service, AuditEvents audit) {
    this.admin = admin; this.organizations = organizations; this.settings = settings; this.service = service; this.audit = audit;
  }
  public record Update(@NotNull Long expectedVersion, @Size(max = 150) String title, @Size(max = 500) String description,
      @Size(max = 100) String buttonLabel, @Pattern(regexp = "#[0-9a-fA-F]{6}") String primaryColor, @Size(max = 1000) String logoUrl) {}
  private String owner(String scope) {
    if ("common".equals(scope)) { admin.requirePlatformAdmin(); return SupportSettingsService.COMMON; }
    if ("organization".equals(scope)) return admin.organization();
    throw new ResponseStatusException(NOT_FOUND);
  }
  @GetMapping("/{scope}")
  public Map<String, Object> get(@PathVariable String scope) { return service.view(owner(scope)); }
  @GetMapping("/impact/common")
  public List<Map<String, Object>> impact() {
    admin.requirePlatformAdmin();
    return organizations.findAll().stream().map(o -> Map.<String,Object>of("organizationId", o.getId(), "name", o.getName(),
        "inherited", SupportSettingsService.DEFAULTS.keySet().stream().filter(k -> !service.values(service.load(o.getId())).containsKey(k)).toList())).toList();
  }
  @PutMapping("/{scope}") @Transactional
  public Map<String, Object> update(@PathVariable String scope, @Valid @RequestBody Update r) {
    String owner;
    if ("common".equals(scope)) { admin.requirePlatformAdmin(); owner = SupportSettingsService.COMMON; }
    else if ("organization".equals(scope)) owner = admin.lockOrganization();
    else throw new ResponseStatusException(NOT_FOUND);
    var row = service.load(owner);
    long version = row.getVersion() == null ? 0 : row.getVersion();
    if (version != r.expectedVersion()) throw new ResponseStatusException(CONFLICT, "설정이 변경됐습니다. 다시 조회한 뒤 저장해 주세요.");
    String before = service.values(row).toString();
    if (r.title() != null && r.title().isBlank() || r.buttonLabel() != null && r.buttonLabel().isBlank())
      throw new ResponseStatusException(BAD_REQUEST, "제목과 버튼 문구는 비워 둘 수 없습니다.");
    if (r.logoUrl() != null && !r.logoUrl().isEmpty()) {
      try {
        var uri = java.net.URI.create(r.logoUrl());
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
          throw new IllegalArgumentException();
      } catch (IllegalArgumentException e) { throw new ResponseStatusException(BAD_REQUEST, "로고는 HTTPS 이미지 주소를 입력해 주세요."); }
    }
    if (r.primaryColor() != null && contrastWithWhite(r.primaryColor()) < 4.5)
      throw new ResponseStatusException(BAD_REQUEST, "버튼 글자가 잘 보이도록 더 어두운 주요 색상을 선택해 주세요.");
    row.update(r.title(), r.description(), r.buttonLabel(), r.primaryColor(), r.logoUrl());
    settings.saveAndFlush(row);
    audit.record(SupportSettingsService.COMMON.equals(owner) ? null : owner, "SUPPORT_SETTINGS_CHANGED", owner,
        "변경 전=" + before + "; 변경 후=" + service.values(row));
    return service.view(owner);
  }
  private static double contrastWithWhite(String color) {
    int rgb = Integer.parseInt(color.substring(1), 16);
    double[] c = {((rgb >> 16) & 255) / 255.0, ((rgb >> 8) & 255) / 255.0, (rgb & 255) / 255.0};
    for (int i = 0; i < 3; i++) c[i] = c[i] <= 0.04045 ? c[i] / 12.92 : Math.pow((c[i] + 0.055) / 1.055, 2.4);
    return 1.05 / (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] + 0.05);
  }
}
