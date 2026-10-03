package kr.shnea.hellow.reporting;

import java.time.*;
import java.util.*;
import kr.shnea.hellow.routing.*;
import kr.shnea.hellow.security.*;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MonitoringService {
  private final NamedParameterJdbcTemplate jdbc;
  private final MembershipRepository members;
  private final AgentPresenceRepository presence;
  private final RoutingService routing;
  public MonitoringService(NamedParameterJdbcTemplate jdbc,MembershipRepository members,AgentPresenceRepository presence,RoutingService routing){this.jdbc=jdbc;this.members=members;this.presence=presence;this.routing=routing;}
  private String memberScope(WorkspaceAccess.Actor actor,Map<String,Object> p){
    p.put("organization",actor.organizationId());String sql="m.organization_id=:organization";
    if(actor.dataScope()!=DataScope.ORGANIZATION){
      p.put("issuer",actor.issuer());p.put("subject",actor.subject());String own="(m.issuer=:issuer AND m.subject=:subject)";
      if(actor.dataScope()==DataScope.TEAM&&!actor.teamIds().isEmpty()){p.put("teams",actor.teamIds());own="("+own+" OR m.team_id IN (:teams))";}
      sql+=" AND "+own;
    }
    return sql;
  }
  @Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public Map<String,Object> agents(WorkspaceAccess.Actor actor,String teamId,Integer page,Integer size,Instant now){
    int offset=page==null?0:page,limit=size==null?50:size;
    if(offset<0||offset>100000||limit<1||limit>100)throw ReportFilter.invalid();
    var p=new HashMap<String,Object>();String sql=memberScope(actor,p)+" AND m.active=true AND m.deleted=false";
    if(!ReportFilter.blank(teamId)){p.put("team",teamId);sql+=" AND m.team_id=:team";}
    p.put("limit",limit+1);p.put("offset",offset*limit);
    var ids=jdbc.queryForList("SELECT m.id FROM memberships m WHERE "+sql+" ORDER BY m.id LIMIT :limit OFFSET :offset",p,Long.class);
    boolean more=ids.size()>limit;if(more)ids=ids.subList(0,limit);
    var views=new ArrayList<Map<String,Object>>();
    for(Long id:ids){
      Membership m=members.findById(id).orElseThrow();var lease=presence.findByIssuerAndSubject(m.getIssuer(),m.getSubject()).filter(v->actor.organizationId().equals(v.getOrganizationId()));
      var view=new LinkedHashMap<String,Object>();view.put("memberId",id);view.put("name",m.getDisplayName());view.put("teamId",m.getTeamId());
      view.put("state",routing.monitoringState(m,now));view.put("heartbeatAt",lease.map(AgentPresence::getHeartbeatAt).orElse(null));
      view.put("leaseExpired",lease.map(v->!v.live(now)).orElse(true));
      view.put("heartbeatExpiresAt",lease.map(AgentPresence::getHeartbeatAt).map(v->v.plusSeconds(45)).orElse(null));views.add(view);
    }
    return Map.of("asOf",now,"items",views,"hasMore",more,"page",offset,"scope",actor.dataScope());
  }
  public Map<String,Object> options(WorkspaceAccess.Actor actor){
    var p=new HashMap<String,Object>();String sql=memberScope(actor,p);
    var list=jdbc.queryForList("SELECT m.id FROM memberships m WHERE "+sql+" ORDER BY m.id LIMIT 501",p,Long.class);
    boolean more=list.size()>500;
    var options=list.stream().limit(500).map(id->members.findById(id).orElseThrow()).map(m->{
      var row=new LinkedHashMap<String,Object>();row.put("id",m.getId());row.put("name",m.getDisplayName());row.put("teamId",m.getTeamId());return row;
    }).toList();
    String teamSql="organization_id=:organization";
    if(actor.dataScope()!=DataScope.ORGANIZATION){p.put("teams",actor.dataScope()==DataScope.TEAM&&!actor.teamIds().isEmpty()?actor.teamIds():actor.teamId()==null?Set.of(""):Set.of(actor.teamId()));teamSql+=" AND id IN (:teams)";}
    var teams=jdbc.query("SELECT id,name FROM teams WHERE "+teamSql+" ORDER BY name,id LIMIT 501",p,(rs,n)->Map.of("id",rs.getString(1),"name",rs.getString(2)));
    var result=new LinkedHashMap<String,Object>();result.put("members",options);result.put("teams",teams.stream().limit(500).toList());result.put("hasMore",more||teams.size()>500);result.put("scope",actor.dataScope());
    if("report:read".equals(actor.permission())){
      String records=BusinessScope.ownershipSql(actor,"r",p);
      result.put("categories",jdbc.query("SELECT DISTINCT category_id,category_path FROM consultations r WHERE "+records+" AND category_id IS NOT NULL ORDER BY category_id,category_path LIMIT 500",p,(rs,n)->Map.of("id",rs.getString(1),"name",Objects.toString(rs.getString(2),"미분류"))));
      result.put("results",jdbc.query("SELECT DISTINCT result_id,result_name FROM consultations r WHERE "+records+" AND result_id IS NOT NULL ORDER BY result_id,result_name LIMIT 500",p,(rs,n)->Map.of("id",rs.getString(1),"name",Objects.toString(rs.getString(2),"결과 미확인"))));
    }
    return result;
  }
  public Map<String,Object> summary(WorkspaceAccess.Actor actor,Instant now){
    var p=new HashMap<String,Object>();String scope=BusinessScope.ownershipSql(actor,"r",p);
    var queues=jdbc.query("SELECT status,COUNT(*) AS count FROM queue_items r WHERE "+scope+" AND status IN ('WAITING','PROCESSING') GROUP BY status ORDER BY status",p,(rs,n)->Map.of("status",rs.getString(1),"count",rs.getLong(2)));
    var callbacks=jdbc.query("SELECT status,COUNT(*) AS count FROM follow_up_actions r WHERE "+scope+" AND action_type='CALLBACK' AND status NOT IN ('COMPLETED','CANCELLED') GROUP BY status ORDER BY status",p,(rs,n)->Map.of("status",rs.getString(1),"count",rs.getLong(2)));
    return Map.of("asOf",now,"scope",actor.dataScope(),"queues",queues,"callbacks",callbacks);
  }
}
