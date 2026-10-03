package kr.shnea.hellow.consultation;
import java.util.*;
import kr.shnea.hellow.security.*;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
/** Saved records and unsaved intakes share a stable, scoped, paged history. */
@Component
public class ConsultationHistoryQuery {
  private final NamedParameterJdbcTemplate jdbc;
  public ConsultationHistoryQuery(NamedParameterJdbcTemplate jdbc){this.jdbc=jdbc;}
  public List<Long> ids(WorkspaceAccess.Actor actor,int page,String search){
    var args=new HashMap<String,Object>();args.put("org",actor.organizationId());args.put("issuer",actor.issuer());args.put("subject",actor.subject());args.put("teams",actor.teamIds().isEmpty()?Set.of(""):actor.teamIds());
    args.put("term","%"+search.trim().toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%");args.put("offset",page*50);
    String sql="select h.id from (select c.id,c.created_at,c.customer_code,c.queue_code,c.category_sub from consultations c where "+scope(actor,"c")+
      " union all select -q.id,q.created_at,q.customer_code,q.code,q.inquiry_type from queue_items q where "+scope(actor,"q")+
      " and not exists(select 1 from consultations r where r.organization_id=q.organization_id and r.queue_code=q.code)) h"+
      " left join queue_items q on q.organization_id=:org and q.code=h.queue_code left join customers u on u.organization_id=:org and u.code=h.customer_code"+
      " where lower(coalesce(u.name,q.customer_name,'')) like :term escape '!' or coalesce(u.phone_number,q.phone_number,'') like :term escape '!' or lower(coalesce(h.category_sub,'')) like :term escape '!'"+
      " order by h.created_at desc,h.id desc limit 51 offset :offset";
    return jdbc.queryForList(sql,args,Long.class);
  }
  private String scope(WorkspaceAccess.Actor a,String alias){
    String tenant=alias+".organization_id=:org";
    if(a.dataScope()==DataScope.ORGANIZATION)return tenant;
    String owner="("+alias+".owner_issuer=:issuer and "+alias+".owner_subject=:subject)";
    if(a.dataScope()==DataScope.TEAM)owner="("+owner+" or "+alias+".team_id in (:teams))";
    return tenant+" and "+owner;
  }
}
