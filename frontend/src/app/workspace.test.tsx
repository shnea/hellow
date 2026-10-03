import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Workspace from './page';
import type { ConsultationDraft } from '@/lib/workspace-data';

vi.mock('@/components/SidebarGNB', () => ({ SidebarGNB: () => <nav>Navigation</nav> }));
vi.mock('@/hooks/use-call', () => ({ useCall: () => ({status:'idle',duration:0,setMuted:vi.fn()}) }));
vi.mock('@/components/QueuePanel', () => ({ QueuePanel: ({queueItems,onSelectQueueItem,onAcceptCall}: {queueItems:{id:string}[];onSelectQueueItem:(id:string)=>void;onAcceptCall:(q:unknown)=>void}) => <div>{queueItems.map(q=><div key={q.id}><button onClick={()=>onSelectQueueItem(q.id)}>{q.id}</button><button onClick={()=>onAcceptCall?.(q)}>accept-{q.id}</button></div>)}</div> }));
vi.mock('@/components/ActiveWorkspace', () => ({ ActiveWorkspace: ({customer,initialDraft,onDraftChange,onSaveConsultation,readOnly}: {customer:{id:string;name:string};initialDraft:ConsultationDraft;readOnly:boolean;onDraftChange:(d:ConsultationDraft)=>void;onSaveConsultation:(d:ConsultationDraft & {isComplete:boolean})=>Promise<void>}) => <section><p>{customer.id}:{customer.name}</p><p>{readOnly?'editor-readonly':'editor-editable'}</p><p>{initialDraft?.memo || 'empty-draft'}</p>
  <button onClick={()=>onDraftChange({categoryMain:'Support',categorySub:'Product',status:'in_progress',selectedTags:[],memo:'A unique draft'})}>type-draft</button>
  <button onClick={()=>void onSaveConsultation({...initialDraft,categoryMain:'Support',categorySub:'Product',selectedTags:[],memo:initialDraft?.memo || '',isComplete:true}).catch(()=>{})}>complete</button></section> }));
vi.mock('@/components/ContextActionPanel', () => ({ ContextActionPanel: () => <aside>History</aside> }));
vi.mock('@/components/Toast', () => ({ ToastContainer: ({toasts}: {toasts:{id:string;title:string}[]}) => <div>{toasts.map(t=><p key={t.id}>{t.title}</p>)}</div> }));

const permissions=['queue:read','queue:accept','customer:read','customer:write','consultation:read','consultation:write','followup:write'];
const serverCustomer={code:'cust-1',registered:true,customerType:'INDIVIDUAL',name:'Latest server name',tier:'Standard',phoneNumber:'010',email:'',totalCalls:0};
function queue(code='queue-1'){return {code,customerCode:'cust-1',type:'TICKET',customerType:'INDIVIDUAL',customerName:'Old request name',companyName:'',phoneNumber:'010',status:'PROCESSING',assignedSubject:'alice',assignedAgent:'Alice',callEnded:false,version:0,summary:'Request',registered:true};}
const response=(body:unknown,status=200)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const flush=async()=>{await act(async()=>{await Promise.resolve();await Promise.resolve();});};
let items:ReturnType<typeof queue>[];
let fetchMock:ReturnType<typeof vi.fn<(path:string,options?:RequestInit)=>Promise<Response>>>;
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  sessionStorage.clear();sessionStorage.setItem('hellow_access_token','test-access-token');items=[queue()];
  fetchMock=vi.fn(async(path:string)=>{
    if(path==='/api/me')return response({subject:'alice',name:'Alice',organizations:[{id:'org-a',name:'A',permissions}]});
    if(path==='/api/queue')return response(items);
    if(path==='/api/customers')return response([serverCustomer]);
    if(path.startsWith('/api/timeline/'))return response([]);
    if(path.startsWith('/api/consultations/customer/'))return response([]);
    if(path.startsWith('/api/consultations/'))return response(null,204);
    return response({});
  });vi.stubGlobal('fetch',fetchMock);
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
describe('workspace regressions',()=>{
  it('explains the waiting editor and enables writing from the accepted server response',async()=>{
    items=[{...queue(),status:'WAITING',assignedSubject:''}];
    const original=fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async(path:string,options?:RequestInit)=>{
      if(path==='/api/queue/queue-1/accept'){items=[queue()];return response(items[0]);}
      return original(path,options);
    });
    render(<Workspace/>);await flush();expect(screen.getByText('editor-readonly')).toBeTruthy();
    expect(screen.getByText('상담 기록 · 읽기 전용')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'상담 수락 후 기록 작성'}));await flush();
    expect(screen.getByText('editor-editable')).toBeTruthy();
    expect(screen.queryByText('상담 기록 · 읽기 전용')).toBeNull();
  });
  it('uses explicit customer ID and latest profile instead of queue-keyed mock data',async()=>{
    render(<Workspace/>);await flush();expect(await screen.findByText('cust-1:Latest server name')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([path])=>path==='/api/timeline/customer/cust-1')).toBe(true);
    const options=fetchMock.mock.calls.find(([path])=>path==='/api/customers')?.[1] as RequestInit;
    expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-access-token');
    expect(new Headers(options.headers).get('X-Organization-ID')).toBe('org-a');
  });
  it('retains each interaction draft when browsing another request',async()=>{
    items=[queue('queue-1'),queue('queue-2')];render(<Workspace/>);await flush();
    fireEvent.click(await screen.findByText('type-draft'));fireEvent.click(screen.getByText('queue-2'));await flush();
    expect(screen.queryByText('A unique draft')).toBeNull();fireEvent.click(screen.getByText('queue-1'));await flush();
    expect(screen.getByText('A unique draft')).toBeTruthy();
  });
  it('preserves input and queue on save failure without announcing success',async()=>{
    const original=fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async(path:string,options?:RequestInit)=>options?.method==='PUT'?response({detail:'Database unavailable'},500):original(path,options));
    render(<Workspace/>);await flush();fireEvent.click(await screen.findByText('type-draft'));fireEvent.click(screen.getByText('complete'));await flush();
    expect(screen.getByText('작업 실패 · 입력 보존')).toBeTruthy();expect(screen.getByText('queue-1')).toBeTruthy();expect(screen.getByText('A unique draft')).toBeTruthy();
    expect(screen.queryByText('상담 저장·완료')).toBeNull();
  });
  it('shows authentication failure without loading mock business data',async()=>{
    fetchMock.mockResolvedValue(response({},401));render(<Workspace/>);await flush();
    expect(await screen.findByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);expect(screen.queryByText('queue-1')).toBeNull();
  });
  it('notifies the first arrival after a successfully synchronized empty queue',async()=>{
    vi.useFakeTimers();items=[];render(<Workspace/>);await flush();items=[queue()];items[0].status='WAITING';
    await act(async()=>{await vi.advanceTimersByTimeAsync(2500);});
    expect(screen.getByRole('dialog',{name:'새 상담 요청이 도착했습니다'})).toBeTruthy();
  });
  it('keeps historical records editable when the queue is empty',async()=>{
    items=[];const original=fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async(path:string,options?:RequestInit)=>{
      if(path==='/api/consultations/customer/cust-1')return response([{id:10,version:0,customerCode:'cust-1',queueCode:null,categoryMain:'Support',categorySub:'Product',status:'COMPLETED',memo:'Historical memo',tags:'',agentName:'Alice',createdAt:'2026-10-02T12:00:00'}]);
      return original(path,options);
    });
    render(<Workspace/>);await flush();expect(screen.getByText('Historical memo')).toBeTruthy();expect(screen.getByText('editor-editable')).toBeTruthy();
    expect(screen.getByRole('button',{name:'새 기록'})).toBeTruthy();
  });
  it('blocks incoming calls throughout after-call processing',async()=>{
    items=[{...queue(),type:'CALL',callEnded:true},{...queue('queue-2'),type:'CALL',status:'WAITING',assignedSubject:''}];
    render(<Workspace/>);await flush();
    const modal=screen.getByRole('dialog',{name:'전화 상담이 들어왔습니다'});expect(modal).toBeTruthy();
    expect((screen.getByRole('button',{name:'통화 수락'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('후처리 중 · 새 통화 수신 차단')).toBeTruthy();
  });
  it('does not overlap slow polls and aborts outstanding reads on unmount',async()=>{
    vi.useFakeTimers();let signal:AbortSignal|undefined;
    const original=fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async(path:string,options?:RequestInit)=>{
      if(path==='/api/queue'){signal=options?.signal as AbortSignal;return new Promise<Response>(()=>{});}
      return original(path,options);
    });
    const view=render(<Workspace/>);await flush();await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});
    expect(fetchMock.mock.calls.filter(([path])=>path==='/api/queue')).toHaveLength(1);
    view.unmount();expect(signal?.aborted).toBe(true);
  });
  it('ignores a pre-completion poll that returns after successful completion',async()=>{
    vi.useFakeTimers();let resolveOld:(response:Response)=>void=()=>{};let queueReads=0;
    const original=fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async(path:string,options?:RequestInit)=>{
      if(path==='/api/queue' && ++queueReads===2) return new Promise<Response>(resolve=>{resolveOld=resolve;});
      if(options?.method==='PUT'){items=[];return response({version:1});}
      return original(path,options);
    });
    render(<Workspace/>);await flush();await act(async()=>{await vi.advanceTimersByTimeAsync(2500);});
    fireEvent.click(screen.getByText('complete'));await flush();await act(async()=>{resolveOld(response([queue()]));});await flush();
    expect(screen.queryByText('queue-1')).toBeNull();expect(screen.getByText('상담 저장·완료')).toBeTruthy();
  });
});
