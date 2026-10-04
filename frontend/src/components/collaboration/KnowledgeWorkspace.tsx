'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {AttachmentAdapter} from '@shnea/editor';
import {BookOpen,Plus,Link as LinkIcon} from 'lucide-react';
import {ApiError,jsonBody} from '@/lib/api';
import {readDocument} from '@/lib/editor-document';
import {workJson,workUpload,workTime,knowledgeKinds,knowledgeStates,visibilityLabels,type Knowledge,type KnowledgeRevision,type WorkFile,type WorkPage} from '@/lib/team-collaboration';
import {ShneaConsultationEditor} from '../ShneaConsultationEditor';
import {WorkAttachment} from './WorkAttachment';
import '../work-list.css';
import './collaboration.css';

interface Draft {requestId:string;expectedVersion:number;title:string;category:string;kind:string;visibility:string;document:string;attachments:WorkFile[];}
const fromView=(v:Knowledge):Draft=>({requestId:crypto.randomUUID(),expectedVersion:v.version,title:v.title,category:v.category,kind:v.kind,visibility:v.visibility,document:v.document,attachments:v.attachments});
const blank=():Draft=>({requestId:crypto.randomUUID(),expectedVersion:0,title:'',category:'',kind:'DOCUMENT',visibility:'ORGANIZATION',document:JSON.stringify(readDocument('')),attachments:[]});
export function KnowledgeWorkspace({active,organizationId,storageKey,canRead,canWrite,canPublish,teamId}:{active:boolean;organizationId:string;storageKey:string;canRead:boolean;canWrite:boolean;canPublish:boolean;teamId?:string}) {
  const allowed=canRead||canWrite||canPublish;
  const [q,setQ]=useState(''),[query,setQuery]=useState(''),[state,setState]=useState(''),[kind,setKind]=useState(''),[page,setPage]=useState(0),[filtersOpen,setFiltersOpen]=useState(false);
  const [rows,setRows]=useState<Knowledge[]>([]),[hasMore,setHasMore]=useState(false),[selected,setSelected]=useState<string|null>(null),[current,setCurrent]=useState<Knowledge|null>(null);
  const [drafts,setDrafts]=useState<Record<string,Draft>>({}),[history,setHistory]=useState<(WorkPage<KnowledgeRevision>&{page:number})|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0),[ready,setReady]=useState(false);
  const flight=useRef(false),mounted=useRef(false),detailAbort=useRef<AbortController|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;if(active&&allowed&&selected){if(!el?.open)el?.showModal();}else el?.close();},[active,allowed,selected]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(!active||ready)return;
    void Promise.resolve().then(()=>{if(!mounted.current)return;try{const saved=sessionStorage.getItem(storageKey);if(saved)setDrafts(JSON.parse(saved));setReady(true);
      const id=new URL(window.location.href).searchParams.get('knowledge');if(id&&/^[a-f0-9-]{36}$/i.test(id))setSelected(id);
    }catch{setError('초안을 읽지 못했습니다. 브라우저 저장소를 확인한 뒤 다시 열어 주세요.');}});
  },[active,ready,storageKey]);
  const store=useCallback((next:Record<string,Draft>)=>{try{sessionStorage.setItem(storageKey,JSON.stringify(next));setDrafts(next);return true;}catch{setError('초안을 보관하지 못했습니다. 이 화면을 닫기 전에 서버에 저장해 주세요.');setDrafts(next);return false;}},[storageKey]);
  useEffect(()=>{if(!active||!allowed)return;const abort=new AbortController();
    void Promise.resolve().then(()=>{if(abort.signal.aborted)return;setLoading(true);
      return workJson<WorkPage<Knowledge>>(`/api/knowledge?${new URLSearchParams({q:query,state,kind,page:String(page)})}`,organizationId,{signal:abort.signal}).then(result=>{if(!abort.signal.aborted){setRows(result.items);setHasMore(result.hasMore);}}).catch(e=>{if(!abort.signal.aborted){setError(e.message);setRows([]);}}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    });return()=>abort.abort();
  },[active,allowed,organizationId,query,state,kind,page,refresh]);
  useEffect(()=>{if(!active||!allowed||!selected||selected==='new')return;const abort=new AbortController();detailAbort.current=abort;
    void workJson<Knowledge>(`/api/knowledge/${encodeURIComponent(selected)}`,organizationId,{signal:abort.signal}).then(v=>{if(abort.signal.aborted)return;setCurrent(v);setHistory(null);
      if(v.editable)setDrafts(previous=>{if(previous[v.id])return previous;const next={...previous,[v.id]:fromView(v)};try{sessionStorage.setItem(storageKey,JSON.stringify(next));}catch{setError('초안을 보관하지 못했습니다. 브라우저 저장소를 확인해 주세요.');}return next;});
    }).catch(e=>{if(!abort.signal.aborted){setCurrent(null);setError(e.message);}});return()=>abort.abort();
  },[active,allowed,organizationId,selected,refresh,storageKey]);
  const doc=current?.id===selected?current:null;
  const draft=selected?drafts[selected]:undefined;
  const editable=canWrite&&(selected==='new'||Boolean(doc?.editable&&doc.state!=='ARCHIVED'));
  const dirty=Boolean(draft&&(selected==='new'||doc&&(draft.title!==doc.title||draft.category!==doc.category||draft.kind!==doc.kind||draft.visibility!==doc.visibility||draft.document!==doc.document||JSON.stringify(draft.attachments.map(f=>f.id))!==JSON.stringify(doc.attachments.map(f=>f.id)))));
  const stale=Boolean(doc&&draft&&draft.expectedVersion!==doc.version);
  const patch=(value:Partial<Draft>)=>{if(selected&&draft)store({...drafts,[selected]:{...draft,...value}});};
  const choose=(id:string|null)=>{if(flight.current)return;setSelected(id);setCurrent(null);setHistory(null);setError('');setNotice('');
    const url=new URL(window.location.href);if(id&&id!=='new')url.searchParams.set('knowledge',id);else url.searchParams.delete('knowledge');window.history.replaceState(null,'',url);
  };
  const create=()=>{if(!ready||busy)return;if(!drafts.new)store({...drafts,new:blank()});choose('new');};
  const save=async()=>{if(!selected||!draft||!editable||flight.current||stale)return;flight.current=true;setBusy(true);setError('');detailAbort.current?.abort();
    try{const body={...draft,document:JSON.parse(draft.document),attachmentIds:draft.attachments.map(f=>f.id),attachments:undefined};
      const v=await workJson<Knowledge>(selected==='new'?'/api/knowledge':`/api/knowledge/${encodeURIComponent(selected)}`,organizationId,{...jsonBody(body),method:selected==='new'?'POST':'PUT'});
      if(!mounted.current)return;const next={...drafts,[v.id]:fromView(v)};if(selected==='new')delete next.new;store(next);setCurrent(v);setSelected(v.id);setNotice('초안을 저장했습니다. 게시된 내용은 게시 버튼을 눌러야 바뀝니다.');setRefresh(x=>x+1);
    }catch(e){if(mounted.current){setError((e as Error).message);if(e instanceof ApiError&&e.status===409)setRefresh(x=>x+1);}}finally{flight.current=false;if(mounted.current)setBusy(false);}
  };
  const transition=async(action:string)=>{if(!doc||!doc.publishable||flight.current||dirty)return;flight.current=true;setBusy(true);setError('');
    try{const v=await workJson<Knowledge>(`/api/knowledge/${doc.id}/${action}`,organizationId,jsonBody({expectedVersion:doc.version}));if(!mounted.current)return;setCurrent(v);if(v.editable)store({...drafts,[v.id]:fromView(v)});setNotice(action==='publish'?'게시했습니다.':action==='archive'?'보관했습니다.':'초안으로 복원했습니다.');setRefresh(x=>x+1);
    }catch(e){if(mounted.current){setError((e as Error).message);if(e instanceof ApiError&&e.status===409)setRefresh(x=>x+1);}}finally{flight.current=false;if(mounted.current)setBusy(false);}
  };
  const adapter=useMemo<AttachmentAdapter>(()=>({platformImageOrigin:'https://platform.shnea.kr',scope:()=>`${organizationId}:knowledge:${selected}`,
    async upload(file,context){if(!selected||selected==='new')throw new Error('먼저 문서 초안을 저장한 뒤 파일을 첨부해 주세요.');if(file.size>50*1024*1024)throw new Error('파일은 최대50MB까지 첨부할 수 있습니다.');
      const f=await workUpload(`/api/knowledge/${selected}/files`,organizationId,file,file.name,context.requestId||crypto.randomUUID(),context.signal);return {fileId:f.id,scope:`${organizationId}:knowledge:${selected}`,kind:context.kind||'file',name:f.name,size:f.size};},
    async resolve(file,signal){const data=await workJson<{originalUrl:string;previewUrl?:string;thumbnailUrl?:string}>(`/api/knowledge/${selected}/files/${encodeURIComponent(file.fileId)}/views`,organizationId,{signal});return {fileId:file.fileId,kind:file.kind,state:"READY",originalUrl:data.originalUrl,downloadUrl:data.originalUrl,viewerUrl:data.originalUrl,previewUrl:data.previewUrl||null,thumbnailUrl:data.thumbnailUrl||null,expiresAt:null};}
  }),[organizationId,selected]);
  const attach=async(file:File)=>{if(!selected||selected==='new'||!draft||flight.current)return;if(file.size>50*1024*1024){setError('파일은 최대50MB까지 선택해 주세요.');return;}flight.current=true;setBusy(true);setError('');
    try{const f=await workUpload(`/api/knowledge/${selected}/files`,organizationId,file,file.name,crypto.randomUUID());if(mounted.current)store({...drafts,[selected]:{...draft,attachments:[...draft.attachments,f]}});
    }catch(e){if(mounted.current)setError((e as Error).message);}finally{flight.current=false;if(mounted.current)setBusy(false);}
  };
  const revisions=async(page=0)=>{if(!doc||busy)return;setBusy(true);setError('');try{const r=await workJson<WorkPage<KnowledgeRevision>>(`/api/knowledge/${doc.id}/revisions?page=${page}`,organizationId);if(mounted.current)setHistory({...r,page});}catch(e){if(mounted.current)setError((e as Error).message);}finally{if(mounted.current)setBusy(false);}};
  const copyLink=async()=>{if(!doc)return;try{const url=new URL('/',window.location.origin);url.searchParams.set('knowledge',doc.id);await navigator.clipboard.writeText(url.href);setNotice('문서 링크를 복사했습니다. 링크를 여는 직원의 권한을 확인합니다.');}catch{setError('링크를 복사하지 못했습니다. 주소창의 문서 주소를 복사해 주세요.');}};
  if(!allowed)return null;
  return <section hidden={!active} className="crm-list-workspace knowledge-workspace" aria-label="지식관리">
    <header className="list-heading"><div><h1>지식관리</h1><p>문서와 FAQ를 검색하고, 확인된 내용을 조직에 게시합니다.</p></div><div className="work-actions">{canWrite&&<button className="work-primary" onClick={create} disabled={!ready}><Plus size={16}/>지식 작성</button>}<button onClick={()=>setRefresh(x=>x+1)} disabled={busy}>다시 조회</button></div></header>
    {!selected&&<>{error&&<p className="list-error" role="alert">{error}</p>}{notice&&<p role="status" className="work-notice">{notice}</p>}</>}
    <button className="list-filter-toggle" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(x=>!x)}>조회 조건 {filtersOpen?'접기':'열기'}</button>
      <form className={`list-filters ${filtersOpen?'filters-open':''}`} onSubmit={e=>{e.preventDefault();setQuery(q);setPage(0);}}><label>제목·분류·본문<input maxLength={200} value={q} onChange={e=>setQ(e.target.value)} placeholder="지식 검색"/></label><label>종류<select value={kind} onChange={e=>{setKind(e.target.value);setPage(0);}}><option value="">전체</option>{Object.entries(knowledgeKinds).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>상태<select value={state} onChange={e=>{setState(e.target.value);setPage(0);}}><option value="">전체</option>{Object.entries(knowledgeStates).filter(([k])=>k==='PUBLISHED'||canWrite||canPublish).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button type="submit">검색</button></form>
      <div className="list-meta"><span>{loading?'조회 중…':`현재 페이지 ${rows.length}건`}</span><span>접근 가능한 지식만 표시 · 페이지당30건</span></div>
      <div className="list-table"><table><thead><tr><th>제목</th><th>종류·분류</th><th>공개 범위</th><th>상태</th><th>수정 시각</th><th>열기</th></tr></thead><tbody>{rows.map(v=><tr key={v.id}><td className="list-row-main"><strong>{v.title}</strong><small>{v.authorName}</small></td><td>{knowledgeKinds[v.kind]} · {v.category||'분류 없음'}</td><td>{visibilityLabels[v.visibility]}</td><td>{knowledgeStates[v.state]}{v.publishedRevision&&v.unpublishedChanges?' · 수정 초안':''}</td><td className="list-row-time"><time dateTime={v.updatedAt}>{workTime(v.updatedAt)}</time></td><td className="list-row-action"><button onClick={()=>choose(v.id)} aria-label={`${v.title} 열기`}>열기</button></td></tr>)}</tbody></table>{!loading&&!rows.length&&<p className="list-empty"><BookOpen size={24}/>{query||kind||state?'조회 조건에 맞는 지식이 없습니다.':'아직 접근 가능한 지식이 없습니다.'}{canWrite?'지식 작성으로 첫 문서를 추가해 주세요.':'게시된 문서와 조회 권한을 확인해 주세요.'}</p>}</div>
      <footer className="list-pagination"><button disabled={page===0||loading} onClick={()=>setPage(x=>x-1)}>이전</button><span>{page+1}페이지</span><button disabled={!hasMore||loading} onClick={()=>setPage(x=>x+1)}>다음</button></footer>
    <dialog ref={dialog} className="knowledge-detail-dialog crm-list-dialog" aria-label={selected==='new'?'지식 작성':'지식 상세보기'} onCancel={e=>{e.preventDefault();e.stopPropagation();if(!busy)choose(null);}}>
      <header className="list-dialog-heading"><h2>{selected==='new'?'지식 작성':'지식 상세보기'}</h2><button autoFocus disabled={busy} onClick={()=>choose(null)}>닫기</button></header>
      {selected&&<div className="knowledge-detail list-dialog-body">
      {error&&<p className="list-error" role="alert">{error}</p>}{notice&&<p role="status" className="work-notice">{notice}</p>}
      {selected!=='new'&&!doc?error?<button onClick={()=>setRefresh(x=>x+1)} disabled={busy}>문서 다시 조회</button>:<p role="status">문서를 확인하고 있습니다.</p>:<>
        <div className="work-actions">{doc&&<><span>{knowledgeStates[doc.state]} · 버전{doc.revision}{doc.publishedRevision?` · 게시 버전${doc.publishedRevision}`:''}</span><button onClick={()=>void copyLink()}><LinkIcon size={16}/>링크 복사</button>{(doc.editable||doc.publishable)&&<button onClick={()=>void revisions()} disabled={busy}>버전 이력</button>}</>}{editable&&<button className="work-primary" disabled={busy||!draft||stale||!dirty} onClick={()=>void save()}>{busy?'저장 확인 중…':'초안 저장'}</button>}{doc?.publishable&&<>{doc.state==='ARCHIVED'?<button disabled={busy} onClick={()=>void transition('restore')}>초안으로 복원</button>:<><button disabled={busy||dirty} onClick={()=>void transition('publish')}>게시</button><button disabled={busy||dirty} onClick={()=>void transition('archive')}>보관</button></>}</>}</div>
        {dirty&&<p className="work-notice">저장하지 않은 초안이 있습니다. 메뉴나 문서를 바꿔도 이 브라우저 탭에 보관합니다.</p>}
        {stale&&<div role="alert" className="list-error"><p>서버 문서가 변경되었습니다. 내 입력은 보존했습니다. 아래 최신 본문을 확인한 뒤 적용해 주세요.</p><details><summary>최신 본문 확인</summary><ShneaConsultationEditor documentKey={`latest:${doc!.id}:${doc!.version}`} queueCode="" organizationId={organizationId} readOnly initialText={doc!.document} attachmentAdapter={adapter}/></details><button disabled={busy} onClick={()=>patch({expectedVersion:doc!.version})}>확인한 최신 버전에 내 초안 적용</button></div>}
        {editable&&draft?<><div className="knowledge-fields"><label>{draft.kind==='FAQ'?'질문':'제목'}<input maxLength={200} value={draft.title} disabled={busy} onChange={e=>patch({title:e.target.value})}/></label><label>분류<input maxLength={100} value={draft.category} disabled={busy} onChange={e=>patch({category:e.target.value})}/></label><label>종류<select value={draft.kind} disabled={busy} onChange={e=>patch({kind:e.target.value})}>{Object.entries(knowledgeKinds).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>공개 범위<select value={draft.visibility} disabled={busy} onChange={e=>patch({visibility:e.target.value})}>{Object.entries(visibilityLabels).filter(([k])=>k!=='TEAM'||teamId||draft.visibility==='TEAM').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div><h2>{draft.kind==='FAQ'?'답변':'본문'}</h2><div className="knowledge-editor"><ShneaConsultationEditor documentKey={`knowledge:${selected}`} queueCode="" organizationId={organizationId} initialText={draft.document} onChangeText={value=>patch({document:value})} readOnly={busy} attachmentAdapter={adapter}/></div></>:doc&&<><h2>{doc.title}</h2><p className="knowledge-meta">{knowledgeKinds[doc.kind]} · {doc.category||'분류 없음'} · {visibilityLabels[doc.visibility]} · {doc.authorName}</p><div className="knowledge-editor"><ShneaConsultationEditor documentKey={`knowledge:${doc.id}:${doc.revision}`} queueCode="" organizationId={organizationId} initialText={doc.document} readOnly attachmentAdapter={adapter}/></div></>}
        <div className="knowledge-files"><h2>첨부파일</h2>{(editable&&draft?draft.attachments:doc?.attachments||[]).map(file=><div key={file.id}><WorkAttachment file={file} path={`/api/knowledge/${selected}/files`} organizationId={organizationId}/>{editable&&<button disabled={busy} onClick={()=>patch({attachments:draft!.attachments.filter(f=>f.id!==file.id)})}>초안에서 제외</button>}</div>)}{editable&&<label className="work-file-select">파일 첨부 · 최대50MB<input type="file" disabled={busy||selected==='new'||(draft?.attachments.length||0)>=50} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void attach(f);}}/></label>}{selected==='new'&&<p>먼저 초안을 저장한 뒤 파일을 첨부해 주세요.</p>}</div>
        {history&&<div className="knowledge-history"><h2>버전 이력</h2><p>이전 버전을 초안에 가져온 뒤 저장·게시할 수 있습니다.</p>{history.items.map(v=><div key={v.revision}><span>버전{v.revision} · {v.title} · {v.editorName} · {workTime(v.createdAt)}</span>{editable&&<button disabled={busy} onClick={()=>{patch({title:v.title,category:v.category,kind:v.kind,visibility:v.visibility,document:v.document,attachments:v.attachments});setNotice(`버전${v.revision}을 초안에 가져왔습니다. 확인 후 저장해 주세요.`);}}>초안으로 가져오기</button>}</div>)}<div className="list-pagination"><button disabled={busy||!history.page} onClick={()=>void revisions(history.page-1)}>이전 버전 페이지</button><span>{history.page+1}페이지</span><button disabled={busy||!history.hasMore} onClick={()=>void revisions(history.page+1)}>다음 버전 페이지</button></div></div>}
      </>}
    </div>}
    </dialog>
  </section>;
}
