'use client';
import {useEffect,useRef,useState} from 'react';
import {ApiError,apiJson} from '@/lib/api';
import {scopeLabels,type DataScope} from '@/lib/admin';
import {agentStateLabels,attemptLabels,type AgentState} from '@/lib/agent-state';
import {nextReportingDay,reportingDate,reportingLabel,reportLabels,seconds,type ReportOptions,type AgentReport,type MonitoringSummary,type ConsultationReport,type FollowUpReport,type ReportSection} from '@/lib/reporting';
import './reporting.css';
import '../work-list.css';
import {DailyTrend,Distribution,CallbackDistribution} from './ReportCharts';

interface Props {active:boolean;organizationId:string;accessKey:string;canMonitor:boolean;canReport:boolean;canReadHistory:boolean;onHistory:()=>void;}
const groups={DAY:'일별',TEAM:'팀별',AGENT:'담당자별',CHANNEL:'채널별',CATEGORY:'분류별',RESULT:'결과별',STATUS:'상태별'};
const initial=()=>({from:reportingDate(),to:reportingDate(),teamId:'',memberId:'',channel:'',categoryId:'',resultId:'',groupBy:'DAY'});
const queueColumns=['received','accepted','connected','waiting','processing','completed','cancelled','automatic_callbacks'];
const recordColumns=['records','completed','in_progress','escalated'];
const callbackColumns=['callbacks','pending','assigned','scheduled','in_progress','completed','failed','cancelled'];
const emptyOptions:ReportOptions={members:[],teams:[],hasMore:false,scope:'SELF'};
function Table({title,section,columns}:{title:string;section:ReportSection;columns:string[]}){
  return <section className="report-section"><h2>{title}</h2><div className="report-table-scroll" tabIndex={0} aria-label={`${title} 표 가로 스크롤`}><table><thead><tr><th scope="col">구분</th>{columns.map(c=><th scope="col" key={c}>{reportLabels[c]}</th>)}</tr></thead><tbody>
    <tr className="report-total"><th scope="row">기간 합계</th>{columns.map(c=><td key={c}>{Number(section.totals[c]||0).toLocaleString('ko-KR')}</td>)}</tr>
    {section.items.map((row,i)=><tr key={`${row.key}:${i}`}><th scope="row">{reportingLabel(row.label)}</th>{columns.map(c=><td key={c}>{Number(row[c]||0).toLocaleString('ko-KR')}</td>)}</tr>)}
  </tbody></table></div>{!section.items.length&&<p className="report-empty">조회 조건에 맞는 항목이 없습니다. 기간이나 필터를 확인해 주세요.</p>}</section>;
}
export function ReportingWorkspace(props:Props){
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [mode,setMode]=useState<'monitor'|'reports'>(props.canReport?'reports':'monitor');
  const [filters,setFilters]=useState(initial);const [applied,setApplied]=useState(initial);
  const [page,setPage]=useState(0);const [refresh,setRefresh]=useState(0);const [automatic,setAutomatic]=useState(true);
  const [options,setOptions]=useState<ReportOptions>(emptyOptions);const [optionError,setOptionError]=useState('');
  const [data,setData]=useState<{agents?:AgentReport;summary?:MonitoringSummary;consultations?:ConsultationReport;followups?:FollowUpReport}|null>(null);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  const requestKey=JSON.stringify({mode,applied,page,organization:props.organizationId,access:props.accessKey});
  const lastKey=useRef('');
  const allowed=mode==='monitor'?props.canMonitor:props.canReport;
  useEffect(()=>{
    if(!props.active||!allowed)return;
    const abort=new AbortController();
    apiJson<ReportOptions>(mode==='monitor'?'/api/monitoring/options':'/api/reports/options',{signal:abort.signal,headers:{'X-Organization-ID':props.organizationId}})
      .then(r=>{if(!abort.signal.aborted){setOptions(r);setOptionError('');}}).catch(e=>{if(!abort.signal.aborted){setOptions(emptyOptions);setOptionError(e.message);}});
    return()=>abort.abort();
  },[props.active,props.organizationId,props.accessKey,allowed,mode,refresh]);
  useEffect(()=>{
    if(!props.active||!allowed)return;
    const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    if(lastKey.current!==requestKey){setData(null);setError('');lastKey.current=requestKey;}
    async function load(){
      setLoading(true);
      try {
        const request={signal:abort.signal,headers:{'X-Organization-ID':props.organizationId}};
        if(mode==='monitor'){
          const query=new URLSearchParams({page:String(page),size:'50',teamId:applied.teamId});
          const [agents,summary]=await Promise.all([apiJson<AgentReport>(`/api/monitoring/agents?${query}`,request),props.canReport?apiJson<MonitoringSummary>('/api/monitoring/summary',request):Promise.resolve(undefined)]);
          if(!abort.signal.aborted){setData({agents,summary});setError('');}
        }else{
          const query=new URLSearchParams({...applied,until:nextReportingDay(applied.to),timeZone:'Asia/Seoul',page:String(page),size:'50'});query.delete('to');
          const [consultations,followups]=await Promise.all([apiJson<ConsultationReport>(`/api/reports/consultations?${query}`,request),apiJson<FollowUpReport>(`/api/reports/followups?${query}`,request)]);
          if(!abort.signal.aborted){setData({consultations,followups});setError('');}
        }
      }catch(e){if(!abort.signal.aborted){if(e instanceof ApiError&&(e.status===401||e.status===403))setData(null);setError((e as Error).message);}}
      finally {if(!abort.signal.aborted){setLoading(false);if(automatic)timer=setTimeout(()=>void load(),15000);}}
    }
    void load();return()=>{abort.abort();if(timer)clearTimeout(timer);};
  },[props.active,props.organizationId,props.accessKey,allowed,props.canReport,mode,applied,page,refresh,automatic,requestKey]);
  const visible=props.active&&allowed;
  if(!props.active)return null;
  const report=data?.consultations;const totals=report?.report.queues.totals;
  const asOf=report?.asOf||data?.agents?.asOf;
  const more=Boolean(data?.agents?.hasMore||report?.report.queues.hasMore||report?.report.records.hasMore||data?.followups?.report.hasMore);
  return <section className="report-workspace crm-list-workspace" aria-label="상담 현황·통계">
    <header className="report-heading list-heading"><div><h1>상담 현황·기본 통계</h1><p>허용된 범위의 직원 상태와 상담·통화·콜백을 확인합니다.</p></div>{props.canReadHistory&&<button onClick={props.onHistory}>상담 이력 열기</button>}</header>
    <nav className="report-tabs" aria-label="현황·통계 전환">{props.canMonitor&&<button aria-pressed={mode==='monitor'} onClick={()=>{setMode('monitor');setPage(0);setData(null);setOptions(emptyOptions);}}>상담 현황</button>}{props.canReport&&<button aria-pressed={mode==='reports'} onClick={()=>{setMode('reports');setPage(0);setData(null);setOptions(emptyOptions);}}>기간 통계</button>}</nav>
    {!visible?<p role="status">이 화면의 조회 권한이 없습니다.</p>:<>
      <button className="list-filter-toggle" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(v=>!v)}>조회 조건 {filtersOpen?'접기':'열기'}</button>
      <form className={`report-filters list-filters ${filtersOpen?'filters-open':''}`} onSubmit={e=>{e.preventDefault();setApplied({...filters});setPage(0);}}>
        {mode==='reports'&&<><label>시작일<input type="date" required value={filters.from} max={filters.to} onChange={e=>setFilters(f=>({...f,from:e.target.value}))}/></label><label>종료일<input type="date" required value={filters.to} min={filters.from} onChange={e=>setFilters(f=>({...f,to:e.target.value}))}/></label></>}
        <label>팀<select value={filters.teamId} onChange={e=>setFilters(f=>({...f,teamId:e.target.value}))}><option value="">허용 범위 전체</option>{options.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        {mode==='reports'&&<>
          <label>담당자<select value={filters.memberId} onChange={e=>setFilters(f=>({...f,memberId:e.target.value}))}><option value="">전체 담당자</option>{options.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label>채널<select value={filters.channel} onChange={e=>setFilters(f=>({...f,channel:e.target.value}))}><option value="">전체 채널</option>{['CALL','TICKET','CALLBACK','RECORD'].map(c=><option key={c} value={c}>{reportingLabel(c)}</option>)}</select></label>
          <label>상담 분류<select value={filters.categoryId} onChange={e=>setFilters(f=>({...f,categoryId:e.target.value}))}><option value="">전체 분류</option>{options.categories?.map((c,i)=><option key={`${c.id}:${i}`} value={c.id}>{reportingLabel(c.name)}</option>)}</select></label>
          <label>상담 결과<select value={filters.resultId} onChange={e=>setFilters(f=>({...f,resultId:e.target.value}))}><option value="">전체 결과</option>{options.results?.map((c,i)=><option key={`${c.id}:${i}`} value={c.id}>{c.name}</option>)}</select></label>
          <label>표 구분<select value={filters.groupBy} onChange={e=>setFilters(f=>({...f,groupBy:e.target.value}))}>{Object.entries(groups).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        </>}
        <button className="report-primary" disabled={loading}>조건 적용</button>
      </form>
      {optionError&&<p role="alert" className="report-error">필터 목록을 불러오지 못했습니다. {optionError}<button onClick={()=>setRefresh(v=>v+1)}>다시 조회</button></p>}
      {options.hasMore&&<p>필터 선택 목록은 최대 500개입니다. 조건 없이 조회해 표에서 확인할 수 있습니다.</p>}
      <div className="report-toolbar"><span>{asOf?`마지막 성공 조회 ${new Date(asOf).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} (한국 시간)`:'아직 조회하지 않았습니다.'} · {scopeLabels[(report?.scope||data?.agents?.scope||options.scope) as DataScope]}</span><label><input type="checkbox" checked={automatic} onChange={e=>setAutomatic(e.target.checked)}/>15초 자동 갱신</label><button disabled={loading} onClick={()=>setRefresh(v=>v+1)}>새로고침</button></div>
      {error&&<p role="alert" className="report-error">조회하지 못했습니다. {error}{data&&' 마지막 성공 결과를 표시하고 있습니다.'}<button onClick={()=>setRefresh(v=>v+1)}>다시 조회</button></p>}
      {loading&&!data&&<p role="status" className="report-empty">상담 현황·통계를 불러오고 있습니다.</p>}
      {mode==='monitor'&&data?.agents&&<>
        {data.summary&&<section className="report-section"><h2>현재 대기·미처리</h2><p>기간과 관계없이 현재 상태로 집계합니다.</p><dl className="report-inline-metrics">{[...data.summary.queues.map(r=>({...r,label:`상담 ${reportingLabel(r.status)}`})),...data.summary.callbacks.map(r=>({...r,label:`콜백 ${reportingLabel(r.status)}`}))].map(r=><div key={r.label}><dt>{r.label}</dt><dd>{r.count.toLocaleString('ko-KR')}건</dd></div>)}</dl>{!data.summary.queues.length&&!data.summary.callbacks.length&&<p>허용 범위의 대기·미처리 업무가 없습니다.</p>}</section>}
        <section className="report-section"><h2>상담사 상태</h2><div className="report-table-scroll" tabIndex={0} aria-label="상담사 상태 표 가로 스크롤"><table><thead><tr><th>직원</th><th>팀</th><th>업무 상태</th><th>접속 확인</th><th>마지막 응답 (한국 시간)</th></tr></thead><tbody>{data.agents.items.map(a=><tr key={a.memberId}><th scope="row">{a.name}</th><td>{options.teams.find(t=>t.id===a.teamId)?.name||'팀 없음'}</td><td>{agentStateLabels[a.state as AgentState]||'상태 미확인'}</td><td>{a.leaseExpired?'응답 만료·오프라인':'최근 응답 있음'}</td><td>{a.heartbeatAt?new Date(a.heartbeatAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'미수집'}</td></tr>)}</tbody></table></div>{!data.agents.items.length&&<p className="report-empty">조회 조건에 맞는 활성 직원이 없습니다.</p>}</section>
      </>}
      {mode==='reports'&&report&&totals&&<>
        <p className="report-definition">한국 시간 · 접수/문서/콜백 각각의 최초 생성일 기준 · 종료일 포함 · 현재 담당·팀 기준. 수락은 음성 연결 성공과 구분합니다.</p>
        {report.report.trends&&<DailyTrend section={report.report.trends} from={applied.from} to={applied.to}/>}
        <div className="report-chart-grid">{report.report.channels&&<Distribution title="채널별 접수" caption="동일한 기간·필터에 속하는 전체 접수의 채널 비중입니다." rows={report.report.channels.items.map(r=>({label:r.label,value:Number(r.received||0)}))}/>}{data?.followups&&<CallbackDistribution totals={data.followups.report.totals}/>}</div>
        {applied.groupBy!=='DAY'&&<Distribution title={`${groups[applied.groupBy as keyof typeof groups]} 접수 비교`} caption="현재 표 페이지의 처음 20행을 비교합니다. 비중의 분모는 표시된 행의 접수 합계입니다." rows={report.report.queues.items.slice(0,20).map(r=>({label:r.label,value:Number(r.received||0)}))}/>}
        <dl className="report-inline-metrics"><div><dt>측정된 평균 수락 대기</dt><dd>{totals.measured_waits?seconds(totals.wait_seconds/totals.measured_waits):'측정 불가'}</dd><small>측정 {totals.measured_waits}건 · 과거 미측정 {totals.unmeasured_waits}건</small></div><div><dt>대기 중 누적 대기</dt><dd>{seconds(totals.current_wait_seconds)}</dd></div><div><dt>실제 연결 통화 합계</dt><dd>{totals.connected?seconds(totals.call_seconds):'연결 통화 없음'}</dd><small>진행 중 {totals.ongoing_calls}건 포함 · 종료 시각 미수집 {totals.unmeasured_calls||0}건 제외</small><small>접수의 전체 통화 시간 · 개인 참여 시간 아님</small></div><div><dt>측정된 평균 연결 통화</dt><dd>{totals.measured_calls?seconds(totals.call_seconds/totals.measured_calls):'측정 불가'}</dd><small>측정 가능한 연결 {totals.measured_calls||0}건 기준</small></div><div><dt>수락된 이관 요청</dt><dd>{report.report.transfers.accepted}건</dd><small>기간 내 생성한 상담 문서 기준</small></div></dl>
        <Table title="접수·통화" section={report.report.queues} columns={queueColumns}/><p className="report-definition">미연결 종료 {totals.unconnected}건 · 미등록 {totals.unregistered}건 · 이관된 통화는 접수 한 건으로 집계합니다.</p>
        <Table title="상담 문서" section={report.report.records} columns={recordColumns}/>
        {data?.followups&&<Table title="콜백 처리" section={data.followups.report} columns={callbackColumns}/>}
        <section className="report-section"><h2>수신 시도 결과</h2><p>조회 조건에 맞는 접수의 시도 수입니다. 한 접수에 여러 시도가 있을 수 있습니다.</p><dl className="report-inline-metrics">{report.report.attempts.map(a=><div key={a.label}><dt>{attemptLabels[a.label]||a.label}</dt><dd>{a.count}회</dd></div>)}</dl>{!report.report.attempts.length&&<p>저장된 수신 시도가 없습니다.</p>}</section>
      </>}
      <footer className="report-pagination list-pagination"><button disabled={!page||loading} onClick={()=>setPage(v=>v-1)}>이전</button><span>{page+1}페이지 · 표별 최대 50행</span><button disabled={!more||loading} onClick={()=>setPage(v=>v+1)}>다음</button></footer>
    </>}
  </section>;
}
