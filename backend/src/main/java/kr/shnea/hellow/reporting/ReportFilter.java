package kr.shnea.hellow.reporting;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

/** Dates are local midnights in the explicit input zone; stored legacy dates are Seoul time. */
public record ReportFilter(LocalDate from,LocalDate until,String timeZone,String teamId,Long memberId,
    String channel,String categoryId,String resultId,String groupBy,Integer page,Integer size) {
  public ReportFilter normalized(Instant now){
    try {
      ZoneId zone=ZoneId.of(blank(timeZone)?"Asia/Seoul":timeZone);
      LocalDate start=from==null?now.atZone(zone).toLocalDate():from;
      LocalDate end=until==null?start.plusDays(1):until;
      if(!end.isAfter(start)||ChronoUnit.DAYS.between(start,end)>366)throw invalid();
      String group=blank(groupBy)?"DAY":groupBy;
      if(!Set.of("DAY","TEAM","AGENT","CHANNEL","CATEGORY","RESULT","STATUS").contains(group))throw invalid();
      if(!blank(channel)&&!Set.of("CALL","TICKET","CALLBACK","RECORD").contains(channel))throw invalid();
      if((page!=null&&page<0)||(page!=null&&page>100000)||(size!=null&&(size<1||size>100)))throw invalid();
      for(String value:new String[]{teamId,categoryId,resultId})if(value!=null&&value.length()>64)throw invalid();
      return new ReportFilter(start,end,zone.getId(),teamId,memberId,channel,categoryId,resultId,group,page==null?0:page,size==null?50:size);
    }catch(DateTimeException e){throw invalid();}
  }
  public Instant start(){return from.atStartOfDay(ZoneId.of(timeZone)).toInstant();}
  public Instant end(){return until.atStartOfDay(ZoneId.of(timeZone)).toInstant();}
  static boolean blank(String value){return value==null||value.isBlank();}
  static ResponseStatusException invalid(){return new ResponseStatusException(BAD_REQUEST,"조회 기간·시간대·분류 조건을 확인해 주세요. 기간은 1~366일, 페이지 크기는 1~100건입니다.");}
}
