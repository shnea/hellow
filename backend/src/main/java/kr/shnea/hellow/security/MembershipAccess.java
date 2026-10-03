package kr.shnea.hellow.security;

import static org.springframework.http.HttpStatus.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Resolve current grants on every request; identity tokens never contain CRM authority. */
@Service
public class MembershipAccess {
  private final OrganizationRoleRepository roles;
  private final TeamRepository teams;
  private final MembershipRepository members;
  public MembershipAccess(OrganizationRoleRepository roles,TeamRepository teams,MembershipRepository members) {this.roles=roles;this.teams=teams;this.members=members;}
  public Map<String,DataScope> grants(Membership member) {
    var result=new HashMap<String,DataScope>();
    if(!member.isActive())return result;
    DataScope direct=DataScope.valueOf(member.getDataScope());
    member.getPermissions().forEach(p->result.put(p,direct));
    roles.findByOrganizationIdOrderByName(member.getOrganizationId()).stream()
      .filter(r->r.isActive()&&member.getRoleIds().contains(r.getId()))
      .forEach(r->r.getGrants().forEach((p,s)->result.merge(p,s,DataScope::wider)));
    if(member.getTeamId()==null || teams.findByOrganizationIdAndId(member.getOrganizationId(),member.getTeamId()).filter(Team::isActive).isEmpty())
      result.entrySet().removeIf(e->e.getValue()==DataScope.TEAM);
    return result;
  }
  public boolean isAdmin(Membership member) {return grants(member).get("organization:admin")==DataScope.ORGANIZATION;}
  public void protectAdministrators(String org) {
    if(members.findByOrganizationIdOrderById(org).stream().noneMatch(this::isAdmin))
      throw new ResponseStatusException(CONFLICT,"마지막 관리자는 해제할 수 없습니다. 다른 관리자를 먼저 지정해 주세요.");
  }
  public Set<String> teamScope(Membership member) {
    if(member.getTeamId()==null)return Set.of();
    var all=teams.findByOrganizationIdOrderByName(member.getOrganizationId());
    var ids=new HashSet<String>();ids.add(member.getTeamId());
    boolean changed;
    do {changed=false;for(var team:all)if(team.isActive()&&ids.contains(team.getParentId()))changed|=ids.add(team.getId());}while(changed);
    return Set.copyOf(ids);
  }
}
