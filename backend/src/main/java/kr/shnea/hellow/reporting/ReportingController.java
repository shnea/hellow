package kr.shnea.hellow.reporting;

import java.time.Clock;
import java.util.*;
import kr.shnea.hellow.security.WorkspaceAccess;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class ReportingController {
  private final WorkspaceAccess access;private final ReportQueries reports;private final MonitoringService monitoring;private final Clock clock;
  public ReportingController(WorkspaceAccess access,ReportQueries reports,MonitoringService monitoring,Clock clock){this.access=access;this.reports=reports;this.monitoring=monitoring;this.clock=clock;}
  private <T> ResponseEntity<T> response(T body){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);}
  @GetMapping("/monitoring/agents")
  public ResponseEntity<?> agents(@RequestParam(required=false) String teamId,@RequestParam(required=false) Integer page,@RequestParam(required=false) Integer size){
    return response(monitoring.agents(access.require("agent:monitor"),teamId,page,size,clock.instant()));
  }
  @GetMapping("/monitoring/summary")
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public ResponseEntity<?> summary(){return response(monitoring.summary(access.require("report:read"),clock.instant()));}
  @GetMapping("/reports/options")
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public ResponseEntity<?> options(){return response(monitoring.options(access.require("report:read")));}
  @GetMapping("/monitoring/options")
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public ResponseEntity<?> monitoringOptions(){return response(monitoring.options(access.require("agent:monitor")));}
  @GetMapping("/reports/consultations")
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public ResponseEntity<?> consultations(@ModelAttribute ReportFilter filter){return report(filter,false);}
  @GetMapping("/reports/followups")
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public ResponseEntity<?> followups(@ModelAttribute ReportFilter filter){return report(filter,true);}
  private ResponseEntity<?> report(ReportFilter filter,boolean followups){
    var actor=access.require("report:read");var now=clock.instant();var f=filter.normalized(now);
    var result=new LinkedHashMap<String,Object>();result.put("asOf",now);result.put("from",f.start());result.put("until",f.end());
    result.put("timeZone",f.timeZone());result.put("definitionVersion",1);result.put("periodBasis","CREATED_AT");result.put("scope",actor.dataScope());
    result.put("report",reports.report(actor,f,now,followups));return response(result);
  }
}
