'use client';
import {useEffect,useRef,useState,type ComponentProps} from 'react';
import {apiJson} from '@/lib/api';
import {ConsultationDetailDialog} from './ConsultationDetailDialog';
import {RecordingIcon} from './RecordingIcon';
import {CustomerRecordsWorkspace} from './CustomerRecordsWorkspace';
import './consultation-history.css';

type Props=ComponentProps<typeof CustomerRecordsWorkspace>&{scope:'all'|'mine'};
interface Row {id:number;customerName:string;phoneNumber:string;customerRegistered:boolean;receivedAt?:string;createdAt:string;type:string;processingStatus:string;status:string;agentName:string;currentAssigneeName?:string;memo:string;recordingStatus?:string;}
const statuses:Record<string,string>={WAITING:'대기',PROCESSING:'처리 중',IN_PROGRESS:'작성 중',COMPLETED:'완료',CANCELLED:'취소·미연결',ESCALATED:'이관'};
const initial={from:'',to:'',name:'',phone:'',status:'',assignee:''};
export function ConsultationHistoryWorkspace(props:Props){
  const [filters,setFilters]=useState(initial);const [applied,setApplied]=useState(initial);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [page,setPage]=useState(0);const [rows,setRows]=useState<Row[]>([]);const [more,setMore]=useState(false);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [refresh,setRefresh]=useState(0);
  const [selected,setSelected]=useState<{id:number;revision:number}|null>(null);const [open,setOpen]=useState(false);
  const serial=useRef(0);const list=useRef<HTMLDivElement>(null);const savedScroll=useRef(0);
  useEffect(()=>{
    if(!props.active||!props.canRead)return;
    const abort=new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);setError('');
    const query=new URLSearchParams({scope:props.scope,page:String(page),name:applied.name,phone:applied.phone,status:applied.status,assignee:applied.assignee});
    if(applied.from)query.set('from',new Date(`${applied.from}T00:00:00`).toISOString());
    if(applied.to){const end=new Date(`${applied.to}T00:00:00`);end.setDate(end.getDate()+1);query.set('to',end.toISOString());}
    apiJson<{items:Row[];hasMore:boolean}>(`/api/consultations?${query}`,{signal:abort.signal}).then(result=>{if(!abort.signal.aborted){setRows(result.items);setMore(result.hasMore);}})
      .catch(e=>{if(!abort.signal.aborted){setRows([]);setError(e.message);}}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[props.active,props.canRead,props.accessKey,props.organizationId,props.recordRefresh,props.scope,page,applied,refresh]);
  useEffect(()=>{if(!props.focus)return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(props.focus);setOpen(true);
  },[props.focus]);
  const close=()=>{setOpen(false);requestAnimationFrame(()=>{if(list.current)list.current.scrollTop=savedScroll.current;});};
  const show=(id:number)=>{savedScroll.current=list.current?.scrollTop||0;setSelected({id,revision:++serial.current});setOpen(true);};
  const title=props.scope==='mine'?'My 상담 이력':'전체 상담 이력';
  return <section hidden={!props.active} className={`history-workspace ${props.active?'':'!hidden'}`} aria-label={title}>
    <header className="history-heading"><div><h1>{title}</h1><p>{props.scope==='mine'?'내가 담당한 상담을 조회하고 기록을 보완합니다.':'조회 권한 범위의 모든 접수와 상담 기록을 확인합니다.'}</p></div><button onClick={()=>setRefresh(v=>v+1)} disabled={loading}>새로고침</button></header>
    <button className="history-filter-toggle" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(v=>!v)}>조회 조건 {filtersOpen?'접기':'열기'}</button>
    <form className={`history-filters ${filtersOpen?'filters-open':''}`} onSubmit={e=>{e.preventDefault();setApplied({...filters});setPage(0);}}>
      <fieldset><legend>접수 날짜</legend><div className="history-date-range"><input aria-label="접수 시작일" type="date" value={filters.from} max={filters.to||undefined} onChange={e=>setFilters(f=>({...f,from:e.target.value}))}/><span>~</span><input aria-label="접수 종료일" type="date" value={filters.to} min={filters.from||undefined} onChange={e=>setFilters(f=>({...f,to:e.target.value}))}/></div></fieldset>
      <label>고객 이름<input maxLength={100} placeholder="이름 검색" value={filters.name} onChange={e=>setFilters(f=>({...f,name:e.target.value}))}/></label>
      <label>전화번호<input maxLength={100} placeholder="전화번호 검색" value={filters.phone} onChange={e=>setFilters(f=>({...f,phone:e.target.value}))}/></label>
      <label>처리 상태<select value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}><option value="">전체 상태</option>{Object.entries(statuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      {props.scope==='all'&&<label>담당자<input maxLength={100} placeholder="담당자 이름" value={filters.assignee} onChange={e=>setFilters(f=>({...f,assignee:e.target.value}))}/></label>}
      <div className="history-filter-actions"><button className="history-primary" disabled={loading||!props.canRead}>조회</button><button type="button" onClick={()=>{setFilters(initial);setApplied(initial);setPage(0);}}>초기화</button></div>
    </form>
    <div className="history-list-heading"><span>{page+1}페이지 · {rows.length}건</span><span>더블 클릭 또는 상세 보기로 기록을 엽니다.</span></div>
    {error&&<p role="alert" className="history-error">{error}<button onClick={()=>setRefresh(v=>v+1)}>다시 조회</button></p>}
    <div ref={list} className="history-table-scroll" aria-busy={loading}>
      {!props.canRead?<p role="status" className="history-empty">상담 이력 조회 권한이 없습니다.</p>:<table><thead><tr><th>접수 일시</th><th>고객 / 전화번호</th><th>유형</th><th>담당자</th><th>처리 상태</th><th>상담 내용</th><th>녹음</th><th><span className="sr-only">상세 보기</span></th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.id} onDoubleClick={e=>{if(!(e.target as HTMLElement).closest('button'))show(r.id);}}>
          <td className="history-time">{new Date(r.receivedAt||r.createdAt).toLocaleString('ko-KR')}</td><td><strong>{r.customerName||'이름 미확인'}</strong>{!r.customerRegistered&&<span className="history-unidentified">미등록</span>}<span className="history-phone">{r.phoneNumber||'번호 미확인'}</span></td>
          <td>{r.type==='CALL'?'음성통화':r.type==='TICKET'?'문의':'상담 기록'}</td><td>{r.currentAssigneeName||r.agentName||'미배정'}</td><td><span className={`history-status status-${r.processingStatus||r.status}`}>{statuses[r.processingStatus||r.status]||r.status}</span></td><td><span className="history-summary">{r.memo||'작성된 내용 없음'}</span></td>
          <td><RecordingIcon status={r.recordingStatus}/></td><td><button onClick={()=>show(r.id)} aria-label={`${r.customerName||'상담'} 상세 보기`}>상세 보기</button></td>
        </tr>)}</tbody></table>}
      {props.canRead&&(loading||!rows.length)&&<p role="status" className="history-empty">{loading?'상담 이력을 불러오고 있습니다.':'조회 조건에 맞는 상담 이력이 없습니다.'}</p>}
    </div>
    <footer className="history-pagination"><button disabled={page===0||loading} onClick={()=>setPage(v=>v-1)}>이전</button><span>{page+1} 페이지</span><button disabled={!more||loading} onClick={()=>setPage(v=>v+1)}>다음</button></footer>
    <ConsultationDetailDialog {...props} focus={selected} open={open} onClose={close} onRecordSaved={()=>{setRefresh(v=>v+1);props.onRecordSaved?.();}}/>
  </section>;
}
