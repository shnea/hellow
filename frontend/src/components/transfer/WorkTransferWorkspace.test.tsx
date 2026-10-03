import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {WorkTransferWorkspace} from './WorkTransferWorkspace';
import type {WorkTransfer} from '@/lib/work-transfer';
const offered={id:'t1',version:1,organizationId:'org',consultationId:7,queueCode:null,recordVersion:1,liveWork:false,
  fromMemberId:1,fromName:'이전 담당',toMemberId:2,toName:'받는 직원',requesterName:'요청 직원',fromIssuer:'issuer',fromSubject:'one',toIssuer:'issuer',toSubject:'two',requesterIssuer:'issuer',requesterSubject:'one',
  status:'OFFERED',reason:'담당 업무 변경',memo:'전달 내용',requestedAt:'2026-10-03T01:00:00Z',expiresAt:'2026-10-03T01:10:00Z',finishedAt:null,outcome:null,canAccept:true,canReject:true,canCancel:false,canReadRecord:false} as WorkTransfer;
const props={active:true,organizationId:'org',accessKey:'read-write',canRead:true,focus:null,onChanged:vi.fn(),onOpenRecord:vi.fn()};
const flush=async()=>{await act(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();});};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('preserves a conflicted reason and baseline until explicitly adopting the new server version',async()=>{
  let task=offered;const commands:unknown[]=[];
  vi.stubGlobal('fetch',vi.fn(async(path:string,o?:RequestInit)=>{
    if(o?.method==='POST'){commands.push(JSON.parse(o.body as string));if(commands.length===1){task={...offered,version:2};return Response.json({detail:'다른 창에서 변경'}, {status:409});}task={...task,status:'ACCEPTED',version:3,canAccept:false,canReject:false,canReadRecord:true};return Response.json(task);}
    return Response.json(path.startsWith('/api/transfers?')?{items:[task],page:0,hasMore:false}:task);
  }));render(<WorkTransferWorkspace {...props}/>);await flush();
  fireEvent.change(screen.getByLabelText('처리 사유'),{target:{value:'내 수락 사유'}});fireEvent.click(screen.getByRole('button',{name:'업무 이관 수락'}));await flush();
  expect((screen.getByLabelText('처리 사유') as HTMLTextAreaElement).value).toBe('내 수락 사유');
  expect((screen.getByRole('button',{name:'업무 이관 수락'}) as HTMLButtonElement).disabled).toBe(true);
  expect(commands).toEqual([{expectedVersion:1,reason:'내 수락 사유'}]);
  fireEvent.click(screen.getByRole('button',{name:'최신 상태 확인 후 처리 준비'}));fireEvent.click(screen.getByRole('button',{name:'업무 이관 수락'}));await flush();
  expect(commands[1]).toEqual({expectedVersion:2,reason:'내 수락 사유'});fireEvent.click(screen.getByRole('button',{name:'상담 기록 열기'}));expect(props.onOpenRecord).toHaveBeenCalledWith(task);
});
it('renders HTTP-success FAILED as failure, retaining the reason for copying',async()=>{
  let task=offered;vi.stubGlobal('fetch',vi.fn(async(path:string,o?:RequestInit)=>{if(o?.method==='POST')task={...offered,status:'FAILED',version:2,outcome:'원본 상담 변경',canAccept:false,canReject:false};return Response.json(path.startsWith('/api/transfers?')?{items:[task],page:0,hasMore:false}:task);}));
  render(<WorkTransferWorkspace {...props}/>);await flush();fireEvent.change(screen.getByLabelText('처리 사유'),{target:{value:'지워지면 안 되는 사유'}});fireEvent.click(screen.getByRole('button',{name:'업무 이관 수락'}));await flush();
  expect(screen.getByText('이관 실패 · 원본 상담 변경')).toBeTruthy();expect(screen.queryByText('처리 결과 · 이관 완료')).toBeNull();
  expect((screen.getByLabelText(/보존한 처리 사유/) as HTMLTextAreaElement).value).toBe('지워지면 안 되는 사유');expect(screen.queryByRole('button',{name:'업무 이관 수락'})).toBeNull();
});
it('uses server readonly capability and retains input after current authority is lost',async()=>{
  let task=offered;vi.stubGlobal('fetch',vi.fn(async(path:string)=>Response.json(path.startsWith('/api/transfers?')?{items:[task],page:0,hasMore:false}:task)));
  const view=render(<WorkTransferWorkspace {...props}/>);await flush();fireEvent.change(screen.getByLabelText('처리 사유'),{target:{value:'보존할 입력'}});
  task={...offered,canAccept:false,canReject:false};view.rerender(<WorkTransferWorkspace {...props} accessKey="read-only"/>);await flush();
  expect(screen.queryByRole('button',{name:'업무 이관 수락'})).toBeNull();expect((screen.getByLabelText(/보존한 처리 사유/) as HTMLTextAreaElement).value).toBe('보존할 입력');expect((screen.getByLabelText(/보존한 처리 사유/) as HTMLTextAreaElement).readOnly).toBe(true);
});
it('ignores late history from a previously selected request and sends direction filters to the API',async()=>{
  let finish:(value:Response)=>void=()=>{};const paths:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>{paths.push(path);if(path==='/api/transfers/t1/history?page=0')return new Promise<Response>(resolve=>{finish=resolve;});return Response.json(path.startsWith('/api/transfers?')?{items:[offered,{...offered,id:'t2',reason:'두 번째 요청'}],page:0,hasMore:false}:path.includes('/history')?[]:{...offered,id:path.endsWith('t2')?'t2':'t1'});}));
  render(<WorkTransferWorkspace {...props}/>);await flush();fireEvent.click(screen.getByRole('button',{name:'수행 이력 조회'}));await flush();fireEvent.click(screen.getByRole('button',{name:/두 번째 요청/}));await flush();
  await act(async()=>{finish(Response.json([{id:1,action:'ACCEPTED',actorName:'늦은 이력',occurredAt:'2026-10-03T01:00:00Z',reason:'다른 요청의 내용'}]));});await flush();
  expect(screen.queryByText('다른 요청의 내용')).toBeNull();fireEvent.change(screen.getByLabelText('요청 구분'),{target:{value:'SENT'}});await flush();expect(paths.some(p=>p.includes('direction=SENT'))).toBe(true);
});
it('treats CALL acceptance as connection preparation and keeps reject available until confirmation',async()=>{
  let task:WorkTransfer={...offered,kind:'CALL',queueCode:'call',liveWork:true};const onChanged=vi.fn();
  vi.stubGlobal('fetch',vi.fn(async(path:string,o?:RequestInit)=>{if(o?.method==='POST')task={...task,status:'CONNECTING',version:2,canAccept:false};return Response.json(path.startsWith('/api/transfers?')?{items:[task],page:0,hasMore:false}:task);}));
  render(<WorkTransferWorkspace {...props} onChanged={onChanged}/>);await flush();fireEvent.change(screen.getByLabelText('처리 사유'),{target:{value:'통화 인수'}});fireEvent.click(screen.getByRole('button',{name:'통화 이관 수락·연결'}));await flush();
  expect(onChanged).toHaveBeenCalledWith(task);expect(screen.getByText('마이크와 음성 연결을 확인하고 있습니다. 확인 전까지 기존 상담사가 통화를 맡습니다.')).toBeTruthy();
  expect(screen.queryByText('처리 결과 · 이관 완료')).toBeNull();expect(screen.getByRole('button',{name:'이관 거절'})).toBeTruthy();expect(screen.getByText('연결 확인 기한')).toBeTruthy();
});
