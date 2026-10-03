package kr.shnea.hellow.security;
import org.springframework.stereotype.Service;
import org.springframework.security.oauth2.jwt.Jwt;
@Service
public class StaffNames {
  private final MembershipRepository members;
  public StaffNames(MembershipRepository members){this.members=members;}
  public static String label(String... candidates){for(String value:candidates)if(value!=null&&!value.isBlank()&&!value.equals("이름 미확인 직원")&&!value.matches("(?i)[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))return value;return "이름 미확인 직원";}
  public static String display(String name,String login){String resolved=label(name,login);String id=label(login);return id.equals("이름 미확인 직원")||resolved.equals(id)||resolved.endsWith("("+id+")")?resolved:resolved+"("+id+")";}
  public static String identity(Jwt jwt){return display(label(jwt.getClaimAsString("nickname"),jwt.getClaimAsString("name")),jwt.getClaimAsString("preferred_username"));}
  public String resolve(String org,String issuer,String subject,String stored){
    if(org==null||issuer==null||subject==null)return label(stored);
    return members.findByOrganizationIdAndIssuerAndSubject(org,issuer,subject).map(m->display(label(m.getDisplayName(),stored),m.getLoginId())).orElseGet(()->label(stored));
  }
}
