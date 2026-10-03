package kr.shnea.hellow.security;

import jakarta.persistence.criteria.*;
import kr.shnea.hellow.customer.Customer;
import kr.shnea.hellow.consultation.Consultation;
import kr.shnea.hellow.queue.QueueItem;
import org.springframework.data.jpa.domain.Specification;

/** Apply both tenant and ownership predicates in SQL before any row is returned. */
public final class BusinessScope {
  private BusinessScope() {}
  public static Predicate predicate(WorkspaceAccess.Actor actor, From<?,?> row, CriteriaBuilder cb) {
    Predicate owned=cb.conjunction();
    if(actor.dataScope()!=DataScope.ORGANIZATION) {
      owned=cb.and(cb.equal(row.get("ownerIssuer"),actor.issuer()),cb.equal(row.get("ownerSubject"),actor.subject()));
      if(actor.dataScope()==DataScope.TEAM&&!actor.teamIds().isEmpty())owned=cb.or(owned,row.get("teamId").in(actor.teamIds()));
      if(actor.participationReadable()){
        Class<?> type=row.getJavaType();
        if(Consultation.class.isAssignableFrom(type)&&!actor.participatedRecords().isEmpty())owned=cb.or(owned,row.get("id").in(actor.participatedRecords()));
        if(!actor.participatedQueues().isEmpty()){
          if(QueueItem.class.isAssignableFrom(type))owned=cb.or(owned,row.get("code").in(actor.participatedQueues()));
          if(kr.shnea.hellow.timeline.TimelineItem.class.isAssignableFrom(type)||kr.shnea.hellow.recording.CallRecording.class.isAssignableFrom(type))owned=cb.or(owned,row.get("queueCode").in(actor.participatedQueues()));
        }
      }
    }
    return cb.and(cb.equal(row.get("organizationId"),actor.organizationId()),owned);
  }
  public static <T extends OrganizationOwned> Specification<T> rows(WorkspaceAccess.Actor actor) {
    return (root,query,cb)->predicate(actor,root,cb);
  }
  public static <T> Specification<T> equal(String field,Object value) {return(root,query,cb)->cb.equal(root.get(field),value);}
  public static Specification<Customer> customers(WorkspaceAccess.Actor actor) {
    return (root,query,cb)->{
      if(actor.dataScope()==DataScope.ORGANIZATION)return predicate(actor,root,cb);
      Subquery<Integer> q=query.subquery(Integer.class);var queue=q.from(QueueItem.class);
      q.select(cb.literal(1)).where(cb.equal(queue.get("customerCode"),root.get("code")),predicate(actor,queue,cb));
      Subquery<Integer> c=query.subquery(Integer.class);var record=c.from(Consultation.class);
      c.select(cb.literal(1)).where(cb.equal(record.get("customerCode"),root.get("code")),predicate(actor,record,cb));
      return cb.and(cb.equal(root.get("organizationId"),actor.organizationId()),
          cb.or(predicate(actor,root,cb),cb.exists(q),cb.exists(c)));
    };
  }
}
