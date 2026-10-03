import React,{StrictMode} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FollowUpWorkspace} from './FollowUpWorkspace';
import type {FollowUp} from '@/lib/followup';
const task:FollowUp={id:1,version:0,actionType:'CALLBACK',title:'계약 재확인',details:'분기 조건',status:'PENDING',queueCode:'q',customerCode:null,createdAt:'2026-10-03T00:00:00Z',creatorName:'Alice',assignedName:null,assignedMemberId:null,proposedAt:null,scheduledAt:null,scheduledEndAt:null,timeZone:null,durationMinutes:null,outcome:null,canWrite:true,canAssign:true,canProcess:true};
const props={active:true,organizationId:'org-a',identityKey:'alice',accessKey:'one',canRead:true,canWrite:true,focus:null,source:null,onCreated:vi.fn(),onChanged:vi.fn(),onSourceClosed:vi.fn()};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
const flush=async()=>{await act(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();});};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('keeps failed edits and versions across reload and requires explicit adoption before retry',async()=>{
  let latest=task;const commands:unknown[]=[];let reject=true;
  vi.stubGlobal('fetch',vi.fn(async(path:string,o?:RequestInit)=>{
    if(path.includes('/assignees'))return response([{memberId:2,name:'Alice',teamId:null}]);
    if(o?.method==='PUT'){commands.push(JSON.parse(o.body as string));if(reject){latest={...task,version:1,details:'다른 창 저장'};return response({detail:'버전 충돌'},409);}latest={...latest,...JSON.parse(o.body as string),version:2};return response(latest);}
    return response(path.includes('?')?{items:[latest],page:0,hasMore:false}:latest);
  }));
  render(<StrictMode><FollowUpWorkspace {...props}/></StrictMode>);await flush();fireEvent.change(screen.getByLabelText('요청 메모'),{target:{value:'보존할 내 입력'}});fireEvent.change(screen.getByLabelText('변경 사유·처리 결과'),{target:{value:'조건 수정'}});
  fireEvent.click(screen.getByRole('button',{name:'요청 내용 저장'}));await flush();expect(screen.getByRole('alert').textContent).toContain('버전 충돌');
  fireEvent.click(screen.getByRole('button',{name:'목록·선택 업무 다시 조회'}));await flush();expect((screen.getByLabelText('요청 메모') as HTMLTextAreaElement).value).toBe('보존할 내 입력');expect((screen.getByRole('button',{name:'요청 내용 저장'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'최신 버전에 내 입력 다시 적용 준비'}));reject=false;fireEvent.click(screen.getByRole('button',{name:'요청 내용 저장'}));await flush();expect(commands).toEqual([{expectedVersion:0,reason:'조건 수정',title:'계약 재확인',details:'보존할 내 입력'},{expectedVersion:1,reason:'조건 수정',title:'계약 재확인',details:'보존할 내 입력'}]);expect(screen.getByText('서버 저장을 확인했습니다.')).toBeTruthy();
});
it('aborts old history and enables history for the newly selected task without stale content',async()=>{
  let resolveOld:(r:Response)=>void=()=>{};let oldSignal:AbortSignal|null=null;
  vi.stubGlobal('fetch',vi.fn(async(path:string,o?:RequestInit)=>{
    if(path.includes('/1/history')){oldSignal=o?.signal as AbortSignal;return new Promise<Response>(r=>resolveOld=r);}
    if(path.includes('/2/history'))return response([]);
    if(path.includes('/assignees'))return response([]);
    if(path.includes('?'))return response({items:[task,{...task,id:2,title:'둘째 업무'}],page:0,hasMore:false});
    return response(path.endsWith('/2')?{...task,id:2,title:'둘째 업무'}:task);
  }));render(<FollowUpWorkspace {...props}/>);await flush();fireEvent.click(screen.getByRole('button',{name:'변경 이력 조회'}));await flush();fireEvent.click(screen.getByRole('button',{name:/둘째 업무/}));await flush();
  expect((oldSignal as unknown as AbortSignal).aborted).toBe(true);expect((screen.getByRole('button',{name:'변경 이력 조회'}) as HTMLButtonElement).disabled).toBe(false);
  await act(async()=>resolveOld(response([{id:1,action:'CREATED',actorName:'잘못된 과거 결과',reason:'old'}])));expect(screen.queryByText(/잘못된 과거 결과/)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'변경 이력 조회'}));await flush();expect(screen.getByText(/확인된 변경 이력이 없습니다/)).toBeTruthy();
});
it('honors server record capabilities even when the organization has write permission',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>response(path.includes('/assignees')?[]:path.includes('?')?{items:[{...task,canWrite:false,canAssign:false,canProcess:false}],hasMore:false}:{...task,canWrite:false,canAssign:false,canProcess:false})));
  render(<FollowUpWorkspace {...props}/>);await flush();expect(screen.queryByRole('button',{name:'요청 내용 저장'})).toBeNull();expect(screen.getByText(/현재 권한으로는 수정할 수 없습니다/)).toBeTruthy();
});
it('keeps local text visible without offering to overwrite a task ended elsewhere',async()=>{
  let latest=task;
  vi.stubGlobal('fetch',vi.fn(async(path:string,o?:RequestInit)=>{
    if(path.includes('/assignees'))return response([]);
    if(o?.method==='PUT'){latest={...task,version:1,status:'CANCELLED',outcome:'고객 취소'};return response({detail:'버전 충돌'},409);}
    return response(path.includes('?')?{items:[latest],hasMore:false}:latest);
  }));
  render(<FollowUpWorkspace {...props}/>);await flush();fireEvent.change(screen.getByLabelText('요청 메모'),{target:{value:'아직 저장하지 못한 연락 내용'}});fireEvent.change(screen.getByLabelText('변경 사유·처리 결과'),{target:{value:'추가 확인'}});
  fireEvent.click(screen.getByRole('button',{name:'요청 내용 저장'}));await flush();fireEvent.click(screen.getByRole('button',{name:'목록·선택 업무 다시 조회'}));await flush();
  expect(screen.getByRole('region',{name:'저장되지 않은 내 입력'}).textContent).toContain('아직 저장하지 못한 연락 내용');expect(screen.getByText('추가 확인')).toBeTruthy();expect(screen.queryByRole('button',{name:'최신 버전에 내 입력 다시 적용 준비'})).toBeNull();expect(screen.queryByRole('button',{name:'요청 내용 저장'})).toBeNull();
});
it('preserves schedule-only and selected assignee inputs when another window ends the task',async()=>{
  let latest=task;
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>response(path.includes('/assignees')?[{memberId:2,name:'방문 직원',teamId:null}]:path.includes('?')?{items:[latest],hasMore:false}:latest)));
  render(<FollowUpWorkspace {...props}/>);await flush();fireEvent.change(screen.getByLabelText('담당자'),{target:{value:'2'}});fireEvent.change(screen.getByLabelText('소요 시간 (분)'),{target:{value:'45'}});fireEvent.change(screen.getByLabelText('확정 일시 · 한국 시간'),{target:{value:'2026-10-10T11:30'}});
  latest={...task,version:1,status:'CANCELLED'};fireEvent.click(screen.getByRole('button',{name:'목록·선택 업무 다시 조회'}));await flush();const retained=screen.getByRole('region',{name:'저장되지 않은 내 입력'});
  expect(retained.textContent).toContain('2026-10-10 11:30 · 45분');expect(retained.textContent).toContain('입력한 담당자 · 방문 직원');expect(screen.queryByRole('button',{name:'담당자·일정 확정'})).toBeNull();
});
