package kr.shnea.hellow.security;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;

/** Bind an administrator-entered login name once, using only the verified issuer's claim. */
@Service
public class MembershipIdentityLinker {
  private final MembershipRepository members;
  private final AuditEvents audit;
  public MembershipIdentityLinker(MembershipRepository members,AuditEvents audit){this.members=members;this.audit=audit;}
  @Transactional
  public void link(Jwt jwt){
    String login=jwt.getClaimAsString("preferred_username");
    String issuer=jwt.getIssuer().toString();
    if(login!=null&&!login.isBlank()&&!login.equals(jwt.getSubject())&&!login.matches("(?i)[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))for(var candidate:members.findByIssuerAndSubjectAndActiveTrue(issuer,login)){
      var locked=members.lockActive(candidate.getOrganizationId(),issuer,login);
      if(locked.isEmpty()||members.findByOrganizationIdAndIssuerAndSubject(candidate.getOrganizationId(),issuer,jwt.getSubject()).isPresent())continue;
      locked.get().bindIdentity(jwt.getSubject());members.saveAndFlush(locked.get());
      audit.record(candidate.getOrganizationId(),"member.identity.link",String.valueOf(candidate.getId()),"verified issuer login bound to immutable subject");
    }
    for(var member:members.findByIssuerAndSubjectAndActiveTrue(issuer,jwt.getSubject()))member.profile(login,StaffNames.label(jwt.getClaimAsString("nickname"),jwt.getClaimAsString("name"),login));
  }
}
