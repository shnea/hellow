package kr.shnea.hellow.security;

import static org.springframework.http.HttpStatus.*;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.*;
import org.springframework.web.server.ResponseStatusException;

@Component
public class WorkspaceAccess {
  private final MembershipRepository memberships;
  private final OrganizationRepository organizations;
  private final MembershipAccess authority;
  private final kr.shnea.hellow.transfer.WorkTransferRepository transfers;

  public WorkspaceAccess(MembershipRepository memberships, OrganizationRepository organizations, MembershipAccess authority,kr.shnea.hellow.transfer.WorkTransferRepository transfers) {
    this.transfers=transfers;
    this.memberships = memberships;
    this.organizations = organizations;
    this.authority = authority;
  }

  public Jwt identity() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt))
      throw new ResponseStatusException(UNAUTHORIZED, "로그인이 필요합니다.");
    return jwt;
  }

  public String organizationId() {
    var request =
        ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
    String organizationId = request.getHeader("X-Organization-ID");
    if (organizationId == null) throw new ResponseStatusException(FORBIDDEN, "업무 조직을 선택해 주세요.");
    return organizationId;
  }

  public Actor require(String permission) {
    return require(organizationId(),identity(),permission);
  }

  /** Stream deliveries re-check current membership and scopes, never reuse an old grant. */
  public Actor require(String organizationId,Jwt jwt,String permission) {
    var member =
        memberships
            .findByOrganizationIdAndIssuerAndSubjectAndActiveTrue(
                organizationId, jwt.getIssuer().toString(), jwt.getSubject())
            .orElseThrow(() -> new ResponseStatusException(FORBIDDEN, "활성 조직 권한이 없습니다."));
    var grants=authority.grants(member);
    if (!organizations.findById(organizationId).map(Organization::isActive).orElse(false)
        || !grants.containsKey(permission))
      throw new ResponseStatusException(FORBIDDEN, "이 작업의 권한이 없습니다.");
    String name = StaffNames.label(member.getDisplayName(),StaffNames.identity(jwt));
    if("이름 미확인 직원".equals(member.getDisplayName()))name=StaffNames.identity(jwt);
    var participated=transfers.readableParticipation(organizationId,jwt.getIssuer().toString(),jwt.getSubject());
    var recordIds=new java.util.HashSet<Long>();var queueCodes=new java.util.HashSet<String>();
    participated.forEach(t->{recordIds.add(t.getConsultationId());if(t.getQueueCode()!=null)queueCodes.add(t.getQueueCode());});
    return new Actor(organizationId, jwt.getSubject(), name,
        jwt.getIssuer().toString(), member.getTeamId(), grants.get(permission), authority.teamScope(member), grants,permission,recordIds,queueCodes);
  }

  public Actor requireAny(String... permissions) {
    for(String permission:permissions) {
      try{return require(permission);}
      catch(ResponseStatusException e){if(!e.getStatusCode().equals(FORBIDDEN))throw e;}
    }
    throw new ResponseStatusException(FORBIDDEN,"이 작업의 권한이 없습니다.");
  }

  public record Actor(String organizationId, String subject, String name, String issuer,
      String teamId, DataScope dataScope, java.util.Set<String> teamIds, java.util.Map<String,DataScope> grants,
      String permission,java.util.Set<Long> participatedRecords,java.util.Set<String> participatedQueues) {
    public Actor(String organizationId,String subject,String name,String issuer,String teamId,DataScope dataScope,java.util.Set<String> teamIds,java.util.Map<String,DataScope> grants){this(organizationId,subject,name,issuer,teamId,dataScope,teamIds,grants,null,java.util.Set.of(),java.util.Set.of());}
    public Actor withScope(DataScope scope){return new Actor(organizationId,subject,name,issuer,teamId,scope,teamIds,grants,permission,participatedRecords,participatedQueues);}
    public boolean participationReadable(){return permission!=null&&java.util.Set.of("consultation:read","queue:read","customer:read","recording:read").contains(permission);}
    private boolean participated(OrganizationOwned row){
      if(!participationReadable())return false;
      if(row instanceof kr.shnea.hellow.consultation.Consultation c)return participatedRecords.contains(c.getId());
      if(row instanceof kr.shnea.hellow.queue.QueueItem q)return participatedQueues.contains(q.getCode());
      if(row instanceof kr.shnea.hellow.timeline.TimelineItem t)return t.getQueueCode()!=null&&participatedQueues.contains(t.getQueueCode());
      if(row instanceof kr.shnea.hellow.recording.CallRecording r)return participatedQueues.contains(r.getQueueCode());
      return false;
    }
    public java.util.Optional<Actor> forPermission(String permission) {
      var scope=grants.get(permission);
      return scope==null?java.util.Optional.empty():java.util.Optional.of(new Actor(organizationId,subject,name,issuer,teamId,scope,teamIds,grants,permission,participatedRecords,participatedQueues));
    }
    public boolean can(String permission,OrganizationOwned row) {return forPermission(permission).map(a->a.allows(row)).orElse(false);}
    public boolean allows(OrganizationOwned row) {
      return organizationId.equals(row.getOrganizationId()) && (dataScope==DataScope.ORGANIZATION
        || issuer.equals(row.getOwnerIssuer())&&subject.equals(row.getOwnerSubject())
        || dataScope==DataScope.TEAM&&row.getTeamId()!=null&&teamIds.contains(row.getTeamId())||participated(row));
    }
    public void requireRow(OrganizationOwned row) {
      if(!allows(row))throw new ResponseStatusException(NOT_FOUND,"접근할 수 있는 기록이 없습니다.");
    }
  }
  public MembershipAccess authority(){return authority;}
}
