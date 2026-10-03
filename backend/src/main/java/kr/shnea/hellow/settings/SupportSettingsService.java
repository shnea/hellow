package kr.shnea.hellow.settings;
import java.util.*;
import org.springframework.stereotype.Service;
@Service
public class SupportSettingsService {
  public static final String COMMON = "__common__";
  public static final Map<String, String> DEFAULTS = Map.of("title", "상담 문의를 접수해 주세요",
      "description", "문의 내용을 남겨주시면 담당 상담사가 확인합니다.", "buttonLabel", "상담 연결 요청하기",
      "primaryColor", "#4f46e5", "logoUrl", "");
  private final SupportSettingsRepository settings;
  public SupportSettingsService(SupportSettingsRepository settings) { this.settings = settings; }
  public SupportSettings load(String ownerId) { return settings.findById(ownerId).orElseGet(() -> new SupportSettings(ownerId)); }
  public Map<String, String> values(SupportSettings s) {
    Map<String, String> values = new LinkedHashMap<>();
    if (s.getTitle() != null) values.put("title", s.getTitle());
    if (s.getDescription() != null) values.put("description", s.getDescription());
    if (s.getButtonLabel() != null) values.put("buttonLabel", s.getButtonLabel());
    if (s.getPrimaryColor() != null) values.put("primaryColor", s.getPrimaryColor());
    if (s.getLogoUrl() != null) values.put("logoUrl", s.getLogoUrl());
    return values;
  }
  public Map<String, String> effective(String ownerId) {
    Map<String, String> values = new LinkedHashMap<>(DEFAULTS);
    values.putAll(values(load(COMMON)));
    if (!COMMON.equals(ownerId)) values.putAll(values(load(ownerId)));
    return values;
  }
  public Map<String, Object> view(String ownerId) {
    var row = load(ownerId);
    return Map.of("version", row.getVersion() == null ? 0 : row.getVersion(), "overrides", values(row), "effective", effective(ownerId));
  }
}
