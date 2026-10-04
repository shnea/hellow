package kr.shnea.hellow.collaboration;

import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/knowledge")
public class KnowledgeController {
  private final KnowledgeService service;

  public KnowledgeController(KnowledgeService service) {
    this.service = service;
  }

  @ModelAttribute
  public void headers(jakarta.servlet.http.HttpServletResponse response) {
    response.setHeader("Cache-Control", "no-store");
  }

  @GetMapping
  public KnowledgeService.PageView list(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "") String state,
      @RequestParam(defaultValue = "") String kind,
      @RequestParam(defaultValue = "0") int page) {
    return service.list(q, state, kind, page);
  }

  @GetMapping("/{id}")
  public KnowledgeService.View read(@PathVariable String id) {
    return service.read(id);
  }

  @PostMapping
  public KnowledgeService.View create(@RequestBody KnowledgeService.Write r) {
    return service.create(r);
  }

  @PutMapping("/{id}")
  public KnowledgeService.View update(
      @PathVariable String id, @RequestBody KnowledgeService.Write r) {
    return service.update(id, r);
  }

  public record Version(long expectedVersion) {}

  @PostMapping("/{id}/{action:publish|archive|restore}")
  public KnowledgeService.View transition(
      @PathVariable String id, @PathVariable String action, @RequestBody Version r) {
    return service.transition(id, action, r.expectedVersion());
  }

  @GetMapping("/{id}/revisions")
  public KnowledgeService.RevisionPage revisions(
      @PathVariable String id, @RequestParam(defaultValue = "0") int page) {
    return service.history(id, page);
  }

  @PostMapping(value = "/{id}/files", consumes = "multipart/form-data")
  public WorkFiles.View upload(
      @PathVariable String id, @RequestParam String requestId, @RequestParam MultipartFile file)
      throws java.io.IOException {
    return service.upload(id, requestId, file);
  }

  @GetMapping("/{id}/files/{file}/views")
  public Map<String, Object> ticket(@PathVariable String id, @PathVariable String file) {
    return service.ticket(id, file);
  }
}
