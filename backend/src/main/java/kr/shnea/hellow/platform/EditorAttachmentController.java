package kr.shnea.hellow.platform;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * SHNEA 에디터 첨부파일 어댑터 연동 컨트롤러 (editor.md 표준 준수)
 */
@RestController
@RequestMapping("/api/editor/files")
public class EditorAttachmentController {

    private final PlatformClient platformClient;
    private final PlatformProperties properties;

    public EditorAttachmentController(PlatformClient platformClient, PlatformProperties properties) {
        this.platformClient = platformClient;
        this.properties = properties;
    }

    /**
     * 에디터 첨부파일 업로드 (POST /api/editor/files)
     * 응답: { fileId, scope, kind, name, size }
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EditorUploadResponse> uploadEditorFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "kind", defaultValue = "attachment") String kind,
            @RequestParam(value = "requestId", required = false) String requestId) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            PlatformClient.FileUploadResult result = platformClient.uploadFile(
                    file.getOriginalFilename() != null ? file.getOriginalFilename() : "editor-file",
                    file.getBytes(),
                    "PUBLIC",
                    "default"
            );

            String scope = properties.getEnvironmentId() != null ?
                    "env-" + properties.getEnvironmentId().substring(0, 8) : "hellow-consultation";

            return ResponseEntity.ok(new EditorUploadResponse(
                    result.fileId(),
                    scope,
                    kind,
                    result.originalName(),
                    result.size()
            ));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 에디터 파일 보기 정보 조회 (GET /api/editor/files/{fileId}/views)
     * 규칙: 플랫폼 POST /api/v1/files/{fileId}/view-ticket 호출 후 응답 JSON 변경 없이 no-store로 반환
     */
    @GetMapping("/{fileId}/views")
    public ResponseEntity<Map<String, Object>> resolveEditorFile(@PathVariable String fileId) {
        Map<String, Object> viewTicket = platformClient.getViewTicket(fileId);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(viewTicket);
    }

    public record EditorUploadResponse(
            String fileId,
            String scope,
            String kind,
            String name,
            long size
    ) {}
}
