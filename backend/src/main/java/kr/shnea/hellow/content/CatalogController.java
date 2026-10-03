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
public class CatalogController {
  private final CatalogService service;private final ConsultationCatalogRepository catalogs;
  private final WorkspaceAccess access;private final AdminAccess admin;private final AuditEvents audit;private final OrganizationRepository organizations;
  public CatalogController(CatalogService service,ConsultationCatalogRepository catalogs,WorkspaceAccess access,AdminAccess admin,AuditEvents audit,OrganizationRepository organizations){
    this.service=service;this.catalogs=catalogs;this.access=access;this.admin=admin;this.audit=audit;this.organizations=organizations;
  }
  @GetMapping("/api/consultation-catalog")
  public CatalogService.View effective(){return service.view(access.requireAny("consultation:read","consultation:write").organizationId());}
  private String owner(String scope,boolean lock){
    if("common".equals(scope)){admin.requirePlatformAdmin();return CatalogService.COMMON;}
    if("organization".equals(scope))return lock?admin.lockOrganization():admin.organization();
    throw new ResponseStatusException(NOT_FOUND);
  }
  @GetMapping("/api/admin/consultation-catalog/{scope}")
  public CatalogService.View view(@PathVariable String scope){return service.view(owner(scope,false));}
  public record Update(@NotNull @Min(0) Long expectedVersion,@NotNull @Min(0) Long expectedCommonVersion,
      boolean inherit,@NotNull @Valid CatalogService.Catalog catalog) {}
  @PutMapping("/api/admin/consultation-catalog/{scope}") @Transactional
  public CatalogService.View update(@PathVariable String scope,@Valid @RequestBody Update r){
    String id=owner(scope,true);catalogs.lockByOwnerId(CatalogService.COMMON);var before=service.view(id);
    if(before.version()!=r.expectedVersion()||(!CatalogService.COMMON.equals(id)&&(before.inherited()||r.inherit())&&before.commonVersion()!=r.expectedCommonVersion()))
      throw new ResponseStatusException(CONFLICT,"분류 또는 공통 목록이 변경됐습니다. 입력을 보존하고 다시 조회해 주세요.");
    if(r.inherit()&&CatalogService.COMMON.equals(id))throw new ResponseStatusException(BAD_REQUEST,"공통 목록은 상속할 수 없습니다.");
    if(!r.inherit())service.validate(r.catalog(),before.effective());
    var row=catalogs.findById(id).orElseGet(()->new ConsultationCatalog(id,service.encode(before.effective())));
    row.update(!r.inherit(),service.encode(r.inherit()?before.effective():r.catalog()));catalogs.saveAndFlush(row);
    audit.record(CatalogService.COMMON.equals(id)?null:id,"CONSULTATION_CATALOG_CHANGED",id,r.inherit()?"공통 목록으로 복원":"분류 "+r.catalog().categories().size()+"건·결과 "+r.catalog().results().size()+"건 설정");
    return service.view(id);
  }
  @GetMapping("/api/admin/consultation-catalog/impact/common")
  public List<Map<String,Object>> impact(){admin.requirePlatformAdmin();return organizations.findAll().stream().map(o->Map.<String,Object>of("organizationId",o.getId(),"name",o.getName(),"inherited",service.view(o.getId()).inherited())).toList();}
}
