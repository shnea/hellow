package kr.shnea.hellow.content;
import java.util.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface TextTemplateRepository extends JpaRepository<TextTemplate,String>{
  List<TextTemplate> findByScopeAndOrganizationIdOrderByName(TextTemplate.Scope scope,String organizationId);
  List<TextTemplate> findByScopeAndOrganizationIdAndOwnerIssuerAndOwnerSubjectOrderByName(TextTemplate.Scope scope,String org,String issuer,String subject);
  List<TextTemplate> findByScopeAndOriginId(TextTemplate.Scope scope,String originId);
  @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select t from TextTemplate t where t.id=:id") Optional<TextTemplate> lockById(@Param("id") String id);
}
