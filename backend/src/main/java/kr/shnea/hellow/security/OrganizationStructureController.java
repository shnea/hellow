package kr.shnea.hellow.security;

import static org.springframework.http.HttpStatus.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/admin")
public class OrganizationStructureController {
  private final AdminAccess admin;
  private final MembershipAccess authority;
  private final TeamRepository teams;
  private final OrganizationRoleRepository roles;
  private final MembershipRepository members;
  private final AuditEvents audit;
  public OrganizationStructureController(AdminAccess admin,MembershipAccess authority,TeamRepository teams,
      OrganizationRoleRepository roles,MembershipRepository members,AuditEvents audit) {
    this.admin=admin;this.authority=authority;this.teams=teams;this.roles=roles;this.members=members;this.audit=audit;
  }
  @GetMapping("/teams") public List<Team> teams(){return teams.findByOrganizationIdOrderByName(admin.organization());}
  @GetMapping("/roles") public List<OrganizationRole> roles(){return roles.findByOrganizationIdOrderByName(admin.organization());}
  public record TeamRequest(@NotBlank @Size(max=100) String name,@Size(max=64) String parentId,Long expectedVersion,boolean active){}
  @PostMapping("/teams") @Transactional
  public Team createTeam(@Valid @RequestBody TeamRequest r) {
    String org=admin.lockOrganization();var id=UUID.randomUUID().toString();validateParent(org,id,r.parentId());
    uniqueTeamName(org,id,r.name().trim());
    var team=teams.saveAndFlush(new Team(id,org,r.name().trim(),r.parentId()));
    audit.record(org,"TEAM_CREATED",id,r.name().trim());return team;
  }
  @PutMapping("/teams/{id}") @Transactional
  public Team updateTeam(@PathVariable String id,@Valid @RequestBody TeamRequest r) {
    String org=admin.lockOrganization();var team=team(org,id);version(team.getVersion(),r.expectedVersion());
    validateParent(org,id,r.parentId());uniqueTeamName(org,id,r.name().trim());
    if(!r.active()&&(teams.findByOrganizationIdOrderByName(org).stream().anyMatch(t->t.isActive()&&id.equals(t.getParentId()))
        ||members.findByOrganizationIdOrderById(org).stream().anyMatch(m->m.isActive()&&id.equals(m.getTeamId()))))
      throw new ResponseStatusException(CONFLICT,"소속 직원과 하위 팀을 먼저 다른 팀으로 이동해 주세요.");
    team.update(r.name().trim(),r.parentId(),r.active());teams.saveAndFlush(team);
    audit.record(org,"TEAM_CHANGED",id,r.name().trim()+"; active="+r.active());return team;
  }
  public record RoleRequest(@NotBlank @Size(max=100) String name,@NotNull @Size(max=50) Map<String,DataScope> grants,Long expectedVersion,boolean active){}
  @PostMapping("/roles") @Transactional
  public OrganizationRole createRole(@Valid @RequestBody RoleRequest r) {
    String org=admin.lockOrganization();validateGrants(r.grants());var id=UUID.randomUUID().toString();uniqueRoleName(org,id,r.name().trim());
    var role=roles.saveAndFlush(new OrganizationRole(id,org,r.name().trim(),r.grants()));
    audit.record(org,"ROLE_CREATED",id,r.name().trim()+"; "+new TreeMap<>(r.grants()));return role;
  }
  @PutMapping("/roles/{id}") @Transactional
  public OrganizationRole updateRole(@PathVariable String id,@Valid @RequestBody RoleRequest r) {
    String org=admin.lockOrganization();var role=role(org,id);version(role.getVersion(),r.expectedVersion());
    validateGrants(r.grants());uniqueRoleName(org,id,r.name().trim());
    if(r.active()&&r.grants().containsValue(DataScope.TEAM)&&members.findByOrganizationIdOrderById(org).stream()
        .anyMatch(m->m.isActive()&&m.getRoleIds().contains(id)&&m.getTeamId()==null))
      throw new ResponseStatusException(BAD_REQUEST,"이 역할에 연결된 직원의 소속 팀을 먼저 지정해 주세요.");
    role.update(r.name().trim(),r.grants(),r.active());roles.saveAndFlush(role);
    authority.protectAdministrators(org);
    audit.record(org,"ROLE_CHANGED",id,r.name().trim()+"; active="+r.active()+"; "+new TreeMap<>(r.grants()));return role;
  }
  public record AccessRequest(@NotNull Long expectedVersion,String teamId,@NotNull @Size(max=50) Set<String> roleIds,@NotNull DataScope dataScope,@NotNull Set<String> permissions){}
  @PutMapping("/memberships/{id}/access") @Transactional
  public Membership assign(@PathVariable Long id,@Valid @RequestBody AccessRequest r) {
    String org=admin.lockOrganization();var member=members.findById(id).filter(m->org.equals(m.getOrganizationId())).orElseThrow(()->new ResponseStatusException(NOT_FOUND));
    version(member.getVersion(),r.expectedVersion());
    if(r.teamId()!=null&&!team(org,r.teamId()).isActive())throw new ResponseStatusException(BAD_REQUEST,"활성 팀을 선택해 주세요.");
    boolean teamRequired=r.dataScope()==DataScope.TEAM;
    for(String roleId:r.roleIds()){
      var role=role(org,roleId);if(!role.isActive())throw new ResponseStatusException(BAD_REQUEST,"활성 역할을 선택해 주세요.");
      teamRequired|=role.getGrants().containsValue(DataScope.TEAM);
    }
    if(teamRequired&&r.teamId()==null)throw new ResponseStatusException(BAD_REQUEST,"팀 범위 권한에는 소속 팀이 필요합니다.");
    OrganizationAdminController.validatePermissions(r.permissions());
    if(r.permissions().contains("organization:admin")&&r.dataScope()!=DataScope.ORGANIZATION)
      throw new ResponseStatusException(BAD_REQUEST,"조직 관리 권한은 조직 전체 범위를 사용해야 합니다.");
    member.update(member.getDisplayName(),r.permissions(),member.isActive());
    member.assignAccess(r.teamId(),r.roleIds(),r.dataScope());members.saveAndFlush(member);authority.protectAdministrators(org);
    audit.record(org,"MEMBER_ACCESS_CHANGED",member.getSubject(),"team="+r.teamId()+"; roles="+new TreeSet<>(r.roleIds())+"; directScope="+r.dataScope());return member;
  }
  private Team team(String org,String id){return teams.findByOrganizationIdAndId(org,id).orElseThrow(()->new ResponseStatusException(NOT_FOUND,"팀을 찾을 수 없습니다."));}
  private OrganizationRole role(String org,String id){return roles.findByOrganizationIdAndId(org,id).orElseThrow(()->new ResponseStatusException(NOT_FOUND,"역할을 찾을 수 없습니다."));}
  private void validateParent(String org,String id,String parentId) {
    var seen=new HashSet<String>();seen.add(id);
    for(String current=parentId;current!=null;){
      if(!seen.add(current))throw new ResponseStatusException(BAD_REQUEST,"자기 자신이나 하위 팀을 상위 팀으로 지정할 수 없습니다.");
      var parent=team(org,current);if(!parent.isActive())throw new ResponseStatusException(BAD_REQUEST,"활성 상위 팀을 선택해 주세요.");current=parent.getParentId();
    }
  }
  private void validateGrants(Map<String,DataScope> grants) {
    OrganizationAdminController.validatePermissions(grants.keySet());
    if(grants.containsValue(null)||grants.containsKey("organization:admin")&&grants.get("organization:admin")!=DataScope.ORGANIZATION)
      throw new ResponseStatusException(BAD_REQUEST,"권한 범위를 확인해 주세요. 조직 관리는 조직 전체 범위가 필요합니다.");
  }
  private void uniqueTeamName(String org,String id,String name){if(teams.findByOrganizationIdOrderByName(org).stream().anyMatch(t->!id.equals(t.getId())&&name.equals(t.getName())))throw new ResponseStatusException(CONFLICT,"같은 이름의 팀이 있습니다.");}
  private void uniqueRoleName(String org,String id,String name){if(roles.findByOrganizationIdOrderByName(org).stream().anyMatch(r->!id.equals(r.getId())&&name.equals(r.getName())))throw new ResponseStatusException(CONFLICT,"같은 이름의 역할이 있습니다.");}
  private void version(Long actual,Long expected){if(!Objects.equals(actual,expected)||expected==null)throw new ResponseStatusException(CONFLICT,"다른 창에서 변경됐습니다. 입력을 보존하고 최신 정보를 확인해 주세요.");}
}
