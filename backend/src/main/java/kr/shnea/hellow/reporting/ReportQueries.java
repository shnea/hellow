package kr.shnea.hellow.reporting;

import java.time.*;
import java.util.*;
import kr.shnea.hellow.security.*;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Aggregate in SQL after scope and filters. No customer data or document bodies leave this class. */
@Repository
public class ReportQueries {
  private final NamedParameterJdbcTemplate jdbc;
  private final MembershipRepository members;
  public ReportQueries(NamedParameterJdbcTemplate jdbc,MembershipRepository members){this.jdbc=jdbc;this.members=members;}
  private static final ZoneId STORAGE_ZONE=ZoneId.of("Asia/Seoul");
  private static String count(String condition,String name){return "COALESCE(SUM(CASE WHEN "+condition+" THEN 1 ELSE 0 END),0) AS "+name;}
  private static final String QUEUE_METRICS=String.join(",",
    "COUNT(*) AS received",count("r.status='WAITING'","waiting"),count("r.status='PROCESSING'","processing"),
    count("r.status='COMPLETED'","completed"),count("r.status='CANCELLED'","cancelled"),
    count("r.assigned_subject IS NOT NULL OR r.first_accepted_at IS NOT NULL","accepted"),
    count("r.type='CALL' AND r.call_started_at IS NOT NULL","connected"),
    count("r.type='CALL' AND r.call_ended=true AND r.call_started_at IS NULL","unconnected"),
    count("r.callback_follow_up_id IS NOT NULL","automatic_callbacks"),count("r.registered=false","unregistered"),
    count("r.first_accepted_at IS NOT NULL","measured_waits"),
    count("r.assigned_subject IS NOT NULL AND r.first_accepted_at IS NULL","unmeasured_waits"),
    "COALESCE(SUM(CASE WHEN r.first_accepted_at IS NOT NULL THEN GREATEST(0,EXTRACT(EPOCH FROM (r.first_accepted_at-(r.created_at AT TIME ZONE 'Asia/Seoul')))) ELSE 0 END),0) AS wait_seconds",
    "COALESCE(SUM(CASE WHEN r.status='WAITING' THEN GREATEST(0,EXTRACT(EPOCH FROM (CAST(:now AS timestamp with time zone)-(r.created_at AT TIME ZONE 'Asia/Seoul')))) ELSE 0 END),0) AS current_wait_seconds",
    "COALESCE(SUM(CASE WHEN r.type='CALL' AND r.call_started_at IS NOT NULL AND (r.call_ended_at IS NOT NULL OR r.call_ended=false) THEN GREATEST(0,EXTRACT(EPOCH FROM (COALESCE(r.call_ended_at,CAST(:now AS timestamp with time zone))-r.call_started_at))) ELSE 0 END),0) AS call_seconds",
    count("r.type='CALL' AND r.call_started_at IS NOT NULL AND (r.call_ended_at IS NOT NULL OR r.call_ended=false)","measured_calls"),
    count("r.type='CALL' AND r.call_started_at IS NOT NULL AND r.call_ended=true AND r.call_ended_at IS NULL","unmeasured_calls"),
    count("r.type='CALL' AND r.call_started_at IS NOT NULL AND r.call_ended=false","ongoing_calls"));
  private static final String RECORD_METRICS=String.join(",","COUNT(*) AS records",
    count("r.status='COMPLETED'","completed"),count("r.status='IN_PROGRESS'","in_progress"),count("r.status='ESCALATED'","escalated"));
  private static final String FOLLOWUP_METRICS=String.join(",","COUNT(*) AS callbacks",
    count("r.status='PENDING'","pending"),count("r.status='ASSIGNED'","assigned"),count("r.status='SCHEDULED'","scheduled"),
    count("r.status='IN_PROGRESS'","in_progress"),count("r.status='COMPLETED'","completed"),count("r.status='FAILED'","failed"),count("r.status='CANCELLED'","cancelled"));
  public Map<String,Object> report(WorkspaceAccess.Actor actor,ReportFilter filter,Instant now,boolean followups){
    Map<String,Object> params=parameters(actor,filter,now);
    if(followups)return section(actor,filter,params,"follow_up_actions",FOLLOWUP_METRICS,"FOLLOWUP");
    var result=new LinkedHashMap<String,Object>();
    result.put("queues",section(actor,filter,params,"queue_items",QUEUE_METRICS,"QUEUE"));
    result.put("records",section(actor,filter,params,"consultations",RECORD_METRICS,"RECORD"));
    // The period is capped at 366 days. Charts include the whole period, independent of table paging.
    var trend=new ReportFilter(filter.from(),filter.until(),filter.timeZone(),filter.teamId(),filter.memberId(),filter.channel(),filter.categoryId(),filter.resultId(),"DAY",0,366);
    result.put("trends",section(actor,trend,parameters(actor,trend,now),"queue_items",QUEUE_METRICS,"QUEUE"));
    var channels=new ReportFilter(filter.from(),filter.until(),filter.timeZone(),filter.teamId(),filter.memberId(),filter.channel(),filter.categoryId(),filter.resultId(),"CHANNEL",0,10);
    result.put("channels",section(actor,channels,parameters(actor,channels,now),"queue_items",QUEUE_METRICS,"QUEUE"));
    String queueWhere=where(actor,filter,params,"QUEUE","r");
    result.put("attempts",rows("SELECT a.outcome AS label,COUNT(*) AS count FROM assignment_attempts a JOIN queue_items r ON r.code=a.queue_code AND r.organization_id=a.organization_id WHERE "+queueWhere+" GROUP BY a.outcome ORDER BY a.outcome",params));
    String recordWhere=where(actor,filter,params,"RECORD","r");
    result.put("transfers",one("SELECT COUNT(*) AS accepted FROM work_transfers w JOIN consultations r ON r.id=w.consultation_id AND r.organization_id=w.organization_id WHERE w.status='ACCEPTED' AND "+recordWhere,params));
    return result;
  }
  private Map<String,Object> parameters(WorkspaceAccess.Actor actor,ReportFilter f,Instant now){
    var p=new HashMap<String,Object>();p.put("from",LocalDateTime.ofInstant(f.start(),STORAGE_ZONE));
    p.put("until",LocalDateTime.ofInstant(f.end(),STORAGE_ZONE));p.put("now",now.atOffset(ZoneOffset.UTC));
    p.put("team",f.teamId());p.put("channel",f.channel());p.put("category",f.categoryId());p.put("result",f.resultId());
    p.put("limit",f.size()+1);p.put("offset",f.page()*f.size());
    if(f.memberId()!=null){
      // Membership is a tenant-qualified identity selector, not authority to see its work.
      var m=members.findById(f.memberId()).filter(v->actor.organizationId().equals(v.getOrganizationId()));
      p.put("memberIssuer",m.map(Membership::getIssuer).orElse(""));p.put("memberSubject",m.map(Membership::getSubject).orElse(""));
    }
    return p;
  }
  private String owned(WorkspaceAccess.Actor actor,String alias,Map<String,Object> p){return BusinessScope.ownershipSql(actor,alias,p);}
  private String where(WorkspaceAccess.Actor actor,ReportFilter f,Map<String,Object> p,String kind,String alias){
    String sql=owned(actor,alias,p)+" AND "+alias+".created_at>=:from AND "+alias+".created_at<:until";
    if(!ReportFilter.blank(f.teamId()))sql+=" AND "+alias+".team_id=:team";
    if(f.memberId()!=null)sql+=" AND "+alias+".owner_issuer=:memberIssuer AND "+alias+".owner_subject=:memberSubject";
    if(kind.equals("FOLLOWUP"))sql+=" AND "+alias+".action_type='CALLBACK'";
    String categoryResult="";
    if(!ReportFilter.blank(f.categoryId()))categoryResult+=" AND c.category_id=:category";
    if(!ReportFilter.blank(f.resultId()))categoryResult+=" AND c.result_id=:result";
    if(!categoryResult.isEmpty()){
      sql+=" AND EXISTS (SELECT 1 FROM consultations c WHERE "+owned(actor,"c",p)+categoryResult+
        (kind.equals("RECORD")?" AND c.id="+alias+".id":" AND c.queue_code="+alias+".queue_code")+")";
      // QueueItem itself uses code; it has no queue_code column.
      if(kind.equals("QUEUE"))sql=sql.replace("c.queue_code="+alias+".queue_code","c.queue_code="+alias+".code");
    }
    if(!ReportFilter.blank(f.channel())){
      if(kind.equals("QUEUE"))sql+=" AND "+alias+".type=:channel";
      else if(kind.equals("RECORD")&&f.channel().equals("RECORD"))sql+=" AND "+alias+".queue_code IS NULL";
      else sql+=" AND EXISTS (SELECT 1 FROM queue_items q WHERE "+owned(actor,"q",p)+" AND q.code="+alias+".queue_code AND q.type=:channel)";
    }
    return sql;
  }
  private Map<String,Object> section(WorkspaceAccess.Actor actor,ReportFilter f,Map<String,Object> p,String table,String metrics,String kind){
    String predicate=where(actor,f,p,kind,"r");
    var total=one("SELECT "+metrics+" FROM "+table+" r WHERE "+predicate,p);
    String expression;String join="";String label=null;
    switch(f.groupBy()){
      case "TEAM" -> {join=" LEFT JOIN teams t ON t.organization_id=r.organization_id AND t.id=r.team_id";expression="t.id";label="t.name";}
      case "AGENT" -> {join=" LEFT JOIN memberships m ON m.organization_id=r.organization_id AND m.issuer=r.owner_issuer AND m.subject=r.owner_subject";expression="m.id";}
      case "CHANNEL" -> {
        if(kind.equals("QUEUE"))expression="r.type";
        else {join=" LEFT JOIN queue_items q ON q.organization_id=r.organization_id AND q.code=r.queue_code AND "+owned(actor,"q",p);expression="COALESCE(q.type,'RECORD')";}
      }
      case "CATEGORY","RESULT" -> {
        String a="r";
        if(!kind.equals("RECORD")){a="c";join=" LEFT JOIN consultations c ON c.organization_id=r.organization_id AND c.queue_code=r."+(kind.equals("QUEUE")?"code":"queue_code")+" AND "+owned(actor,"c",p);}
        expression=a+(f.groupBy().equals("CATEGORY")?".category_id":".result_id");
        label=a+(f.groupBy().equals("CATEGORY")?".category_path":".result_name");
      }
      case "STATUS" -> expression="r.status";
      default -> {
        // Group by the same input timezone as date filters, including non-Seoul days.
        p.put("zone",f.timeZone());expression="CAST((r.created_at AT TIME ZONE 'Asia/Seoul') AT TIME ZONE :zone AS date)";
      }
    }
    String labels=label==null?"":" ,"+label+" AS label";
    String grouping=label==null?"1":"1,2";
    var grouped=rows("SELECT "+expression+" AS group_key"+labels+","+metrics+" FROM "+table+" r"+join+" WHERE "+predicate+" GROUP BY "+grouping+" ORDER BY 1 NULLS LAST"+(label==null?"":",2 NULLS LAST")+" LIMIT :limit OFFSET :offset",p);
    boolean more=grouped.size()>f.size();if(more)grouped=grouped.subList(0,f.size());
    for(var row:grouped){
      Object key=row.remove("group_key");row.put("key",key);
      if(f.groupBy().equals("AGENT")&&key instanceof Number n)row.put("label",members.findById(n.longValue()).map(Membership::getDisplayName).orElse("이름 미확인 직원"));
      else if(row.get("label")==null)row.put("label",key==null?"미배정·미분류":key.toString());
    }
    var result=new LinkedHashMap<String,Object>();result.put("totals",total);result.put("items",grouped);result.put("hasMore",more);result.put("page",f.page());return result;
  }
  private Map<String,Object> one(String sql,Map<String,Object> p){return rows(sql,p).getFirst();}
  private List<Map<String,Object>> rows(String sql,Map<String,Object> p){
    return jdbc.query(sql,p,(rs,index)->{var row=new LinkedHashMap<String,Object>();var meta=rs.getMetaData();for(int i=1;i<=meta.getColumnCount();i++)row.put(meta.getColumnLabel(i).toLowerCase(Locale.ROOT),rs.getObject(i));return row;});
  }
}
