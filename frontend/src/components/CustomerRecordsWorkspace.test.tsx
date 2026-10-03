import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {CustomerRecordsWorkspace} from './CustomerRecordsWorkspace';
import type {ConsultationDraft} from '@/lib/workspace-data';
vi.mock('./ActiveWorkspace',()=>({ActiveWorkspace:({initialDraft,onDraftChange,onSaveConsultation,readOnly}:{initialDraft:ConsultationDraft;onDraftChange:(d:ConsultationDraft)=>void;onSaveConsultation:(d:ConsultationDraft&{isComplete:boolean})=>Promise<unknown>;readOnly:boolean})=><div><textarea aria-label="검수 본문" value={initialDraft.memo} readOnly={readOnly} onChange={e=>onDraftChange({...initialDraft,memo:e.target.value})}/><button disabled={readOnly} onClick={()=>void onSaveConsultation({...initialDraft,isComplete:false}).catch(()=>{})}>검수 저장</button></div>}));
const customer={id:'c',customerType:'individual' as const,name:'등록 고객',phoneNumber:'01012345678',company:'',email:'',tier:'Standard' as const,isRegistered:true,lastContactDate:'',totalCalls:0,managerName:'',customerNotes:''};
const record={id:1,version:0,customerCode:'c',queueCode:'q',categoryMain:'일반',categorySub:'문의',status:'COMPLETED',memo:'원본',editorDocument:null,tags:'',agentName:'직원',createdAt:'2026-10-03T00:00:00Z',editable:true};
const props={customers:[customer],organizationId:'org',accessKey:'staff',canRead:true,canWrite:true,canEditCustomer:false,active:true,activeQueues:{},onCustomerSaved:vi.fn(),canRequestFollowUp:true,onRequestFollowUp:vi.fn()};
const flush=async()=>{await act(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();});};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('loads completed history when returning from the queue and supports requesting followup',async()=>{
  let rows:unknown[]=[];const fetcher=vi.fn(async()=>Response.json(rows));vi.stubGlobal('fetch',fetcher);
  const view=render(<CustomerRecordsWorkspace {...props}/>);await flush();expect(screen.getByText('상담 기록 0건')).toBeTruthy();view.rerender(<CustomerRecordsWorkspace {...props} active={false}/>);rows=[record];view.rerender(<CustomerRecordsWorkspace {...props}/>);await flush();
  expect(screen.getByText('상담 기록 1건')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'콜백·방문 요청'}));expect(props.onRequestFollowUp).toHaveBeenCalledWith('q','등록 고객');expect(fetcher).toHaveBeenCalledTimes(2);
});
it('preserves a local draft and its version on background history refresh until explicit adoption',async()=>{
  let latest=record;const commands:unknown[]=[];
  vi.stubGlobal('fetch',vi.fn(async(_path:string,o?:RequestInit)=>{if(o?.method==='PUT'){commands.push(JSON.parse(o.body as string));latest={...latest,version:2,memo:'내 수정'};}return Response.json(o?.method==='PUT'?latest:[latest]);}));
  const view=render(<CustomerRecordsWorkspace {...props} recordRefresh={0}/>);await flush();fireEvent.change(screen.getByLabelText('검수 본문'),{target:{value:'내 수정'}});latest={...record,version:1,memo:'다른 직원 수정'};view.rerender(<CustomerRecordsWorkspace {...props} recordRefresh={1}/>);await flush();
  expect((screen.getByLabelText('검수 본문') as HTMLTextAreaElement).value).toBe('내 수정');expect((screen.getByRole('button',{name:'검수 저장'}) as HTMLButtonElement).disabled).toBe(true);expect(screen.getByText('다른 직원 수정')).toBeTruthy();expect(commands).toEqual([]);
  fireEvent.click(screen.getByRole('button',{name:'최신 버전에 내 입력 다시 적용 준비'}));fireEvent.click(screen.getByRole('button',{name:'검수 저장'}));await flush();expect(commands).toEqual([expect.objectContaining({expectedVersion:1,memo:'내 수정'})]);
});
