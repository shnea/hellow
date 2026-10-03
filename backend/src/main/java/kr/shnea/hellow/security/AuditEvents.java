package kr.shnea.hellow.security;
import org.springframework.stereotype.Service;
@Service
public class AuditEvents {
  private final WorkspaceAccess workspace;
  private final AuditEventRepository events;
  public AuditEvents(WorkspaceAccess workspace, AuditEventRepository events) { this.workspace = workspace; this.events = events; }
  public void record(String organizationId, String action, String target, String details) {
    var jwt = workspace.identity();
    events.save(new AuditEvent(organizationId, jwt.getIssuer().toString(), jwt.getSubject(), action, target, details));
  }
}
