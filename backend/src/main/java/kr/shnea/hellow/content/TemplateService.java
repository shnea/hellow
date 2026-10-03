package kr.shnea.hellow.content;
import java.util.*;
import org.springframework.stereotype.Service;
@Service
public class TemplateService {
  public record View(String id,String overrideId,String name,String body,boolean active,long version,long commonVersion,
      String scope,String source,boolean inherited) {}
  private final TextTemplateRepository templates;
  public TemplateService(TextTemplateRepository templates){this.templates=templates;}
  public View direct(TextTemplate t){return new View(t.getId(),null,t.getName(),t.getBody(),t.isActive(),t.getVersion()+1,0,t.getScope().name(),t.getScope().name(),false);}
  public List<View> shared(String org){
    var rows=templates.findByScopeAndOrganizationIdOrderByName(TextTemplate.Scope.ORGANIZATION,org);
    Map<String,TextTemplate> overrides=new HashMap<>();rows.stream().filter(t->t.getOriginId()!=null).forEach(t->overrides.put(t.getOriginId(),t));
    List<View> result=new ArrayList<>();
    for(var common:templates.findByScopeAndOrganizationIdOrderByName(TextTemplate.Scope.COMMON,CatalogService.COMMON)){
      var override=overrides.get(common.getId());boolean inherited=override==null||override.isInherited();var effective=inherited?common:override;
      // An organization override owns its active flag as well as its content.
      result.add(new View(common.getId(),override==null?null:override.getId(),effective.getName(),effective.getBody(),effective.isActive(),
          override==null?0:override.getVersion()+1,common.getVersion()+1,"ORGANIZATION",inherited?"COMMON":"ORGANIZATION",inherited));
    }
    rows.stream().filter(t->t.getOriginId()==null).map(this::direct).forEach(result::add);
    result.sort(Comparator.comparing(View::name));return result;
  }
  public List<View> personal(String org,String issuer,String subject){return templates.findByScopeAndOrganizationIdAndOwnerIssuerAndOwnerSubjectOrderByName(TextTemplate.Scope.PERSONAL,org,issuer,subject).stream().map(this::direct).toList();}
}
