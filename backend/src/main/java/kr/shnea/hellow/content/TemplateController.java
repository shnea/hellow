package kr.shnea.hellow.content;

import static org.springframework.http.HttpStatus.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import kr.shnea.hellow.security.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class TemplateController {
  private final TextTemplateRepository templates;private final TemplateService service;
  private final WorkspaceAccess access;private final AdminAccess admin;private final AuditEvents audit;
  private final OrganizationRepository organizations;
  public TemplateController(TextTemplateRepository templates,TemplateService service,WorkspaceAccess access,AdminAccess admin,AuditEvents audit,OrganizationRepository organizations){this.templates=templates;this.service=service;this.access=access;this.admin=admin;this.audit=audit;this.organizations=organizations;}
  @GetMapping("/api/templates")
  public List<TemplateService.View> usable(){var actor=access.requireAny("consultation:read","consultation:write");var result=new ArrayList<>(service.shared(actor.organizationId()));
    result.addAll(service.personal(actor.organizationId(),actor.issuer(),actor.subject()));return result.stream().filter(TemplateService.View::active).toList();}
  @GetMapping("/api/templates/personal")
  public List<TemplateService.View> personal(){var actor=access.require("template:personal");return service.personal(actor.organizationId(),actor.issuer(),actor.subject());}
  private String organization(String scope,boolean lock){
    if("common".equals(scope)){admin.requirePlatformAdmin();return CatalogService.COMMON;}
    if("organization".equals(scope))return lock?admin.lockOrganization():admin.organization();
    throw new ResponseStatusException(NOT_FOUND);
  }
  @GetMapping("/api/admin/templates/{scope}")
  public List<TemplateService.View> managed(@PathVariable String scope){var org=organization(scope,false);
    return "common".equals(scope)?templates.findByScopeAndOrganizationIdOrderByName(TextTemplate.Scope.COMMON,org).stream().map(service::direct).toList():service.shared(org);}
  public record Write(@NotNull @Min(0) Long expectedVersion,@NotBlank @Size(max=150) String name,@NotBlank @Size(max=200000) String body,
      boolean active,@Size(max=64) String originId,@Min(0) Long expectedCommonVersion) {}
  private TextTemplate apply(TextTemplate row,Write r){
    if((row.getVersion()==null?0:row.getVersion()+1)!=r.expectedVersion())throw new ResponseStatusException(CONFLICT,"템플릿이 변경됐습니다. 입력을 보존하고 다시 조회해 주세요.");
    if(!Objects.equals(row.getOriginId(),r.originId()))throw new ResponseStatusException(BAD_REQUEST,"템플릿의 공통 원본은 변경할 수 없습니다.");
    row.update(r.name().trim(),r.body(),r.active());return templates.saveAndFlush(row);
  }
  @PostMapping("/api/templates/personal") @Transactional
  public TemplateService.View createPersonal(@Valid @RequestBody Write r){var a=access.require("template:personal");if(r.originId()!=null)throw new ResponseStatusException(BAD_REQUEST);
    var row=new TextTemplate(UUID.randomUUID().toString(),TextTemplate.Scope.PERSONAL,a.organizationId(),null,a.issuer(),a.subject());return service.direct(apply(row,r));}
  @PutMapping("/api/templates/personal/{id}") @Transactional
  public TemplateService.View updatePersonal(@PathVariable String id,@Valid @RequestBody Write r){var a=access.require("template:personal");
    var row=templates.findById(id).filter(t->t.getScope()==TextTemplate.Scope.PERSONAL&&t.getOrganizationId().equals(a.organizationId())&&t.getOwnerIssuer().equals(a.issuer())&&t.getOwnerSubject().equals(a.subject())).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    // Personal changes use optimistic locking. Administrators have no override path.
    return service.direct(apply(row,r));}
  @PostMapping("/api/admin/templates/{scope}") @Transactional
  public List<TemplateService.View> create(@PathVariable String scope,@Valid @RequestBody Write r){var org=organization(scope,true);
    if(r.originId()!=null){
      if(!"organization".equals(scope))throw new ResponseStatusException(BAD_REQUEST);
      requireCommon(r.originId(),r.expectedCommonVersion());
      if(templates.findByScopeAndOrganizationIdOrderByName(TextTemplate.Scope.ORGANIZATION,org).stream().anyMatch(t->r.originId().equals(t.getOriginId())))throw new ResponseStatusException(CONFLICT,"조직 설정이 이미 있습니다. 다시 조회해 주세요.");
    }
    var row=new TextTemplate(UUID.randomUUID().toString(),"common".equals(scope)?TextTemplate.Scope.COMMON:TextTemplate.Scope.ORGANIZATION,org,r.originId(),null,null);
    apply(row,r);audit.record(CatalogService.COMMON.equals(org)?null:org,"TEMPLATE_CHANGED",row.getId(),"공유 템플릿 생성");return managed(scope);
  }
  @PutMapping("/api/admin/templates/{scope}/{id}") @Transactional
  public List<TemplateService.View> update(@PathVariable String scope,@PathVariable String id,@Valid @RequestBody Write r){var org=organization(scope,true);
    var row=templates.lockById(id).filter(t->t.getOrganizationId().equals(org)&&t.getScope()==("common".equals(scope)?TextTemplate.Scope.COMMON:TextTemplate.Scope.ORGANIZATION)).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    if(row.getOriginId()!=null)requireCommon(row.getOriginId(),r.expectedCommonVersion());
    apply(row,r);audit.record(CatalogService.COMMON.equals(org)?null:org,"TEMPLATE_CHANGED",id,"공유 템플릿 수정·active="+r.active());return managed(scope);
  }
  public record Restore(@NotNull @Min(0) Long expectedVersion,@NotNull @Min(0) Long expectedCommonVersion) {}
  @PostMapping("/api/admin/templates/organization/{id}/restore") @Transactional
  public List<TemplateService.View> restore(@PathVariable String id,@Valid @RequestBody Restore r){var org=admin.lockOrganization();
    var row=templates.lockById(id).filter(t->t.getScope()==TextTemplate.Scope.ORGANIZATION&&t.getOrganizationId().equals(org)&&t.getOriginId()!=null).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    if(row.getVersion()+1!=r.expectedVersion())throw new ResponseStatusException(CONFLICT,"템플릿이 변경됐습니다. 다시 조회해 주세요.");
    requireCommon(row.getOriginId(),r.expectedCommonVersion());row.restore();templates.saveAndFlush(row);audit.record(org,"TEMPLATE_CHANGED",id,"공통 템플릿으로 복원");return service.shared(org);
  }
  private void requireCommon(String id,Long version){var common=templates.lockById(id).filter(t->t.getScope()==TextTemplate.Scope.COMMON).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    if(version==null||common.getVersion()+1!=version)throw new ResponseStatusException(CONFLICT,"공통 템플릿이 변경됐습니다. 다시 조회해 주세요.");}
  @GetMapping("/api/admin/templates/impact/{id}")
  public List<Map<String,Object>> impact(@PathVariable String id){admin.requirePlatformAdmin();
    var common=templates.findById(id).filter(t->t.getScope()==TextTemplate.Scope.COMMON).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    // This endpoint reports configuration only, never personal template content.
    Map<String,Boolean> overridden=new HashMap<>();templates.findByScopeAndOriginId(TextTemplate.Scope.ORGANIZATION,common.getId()).stream()
        .forEach(t->overridden.put(t.getOrganizationId(),!t.isInherited()));
    return organizations.findAll().stream().map(o->Map.<String,Object>of("organizationId",o.getId(),"name",o.getName(),"overridden",overridden.getOrDefault(o.getId(),false))).toList();
  }
}
