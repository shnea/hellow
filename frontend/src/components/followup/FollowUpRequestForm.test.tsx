import React,{StrictMode} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {FollowUpRequestForm} from './FollowUpRequestForm';
const key='hellow_followup_pending:org-a:alice:q:CALLBACK';
const props={organizationId:'org-a',identityKey:'alice',queueCode:'q',actionType:'CALLBACK' as const,disabled:false,onCreated:vi.fn(),onOpenList:vi.fn()};
const flush=async()=>{await act(async()=>{await Promise.resolve();await Promise.resolve();});};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
beforeEach(()=>{sessionStorage.clear();props.onCreated.mockClear();});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function fill(){fireEvent.change(screen.getByLabelText('요청 목적'),{target:{value:'견적 확인'}});fireEvent.change(screen.getByLabelText('요청 메모'),{target:{value:'고객과 다시 확인\n계약 조건'}});}
it('persists before transmitting, restores without POST and repeats the same ID after an uncertain response',async()=>{
  const sent:unknown[]=[];const fetch=vi.fn(async(path:string,o?:RequestInit)=>{
    if(path.includes('/request/'))return response(null);
    const payload=JSON.parse(o?.body as string);expect(JSON.parse(sessionStorage.getItem(key)!)).toEqual(payload);sent.push(payload);
    if(sent.length===1)throw new Error('네트워크 응답 없음');return response({id:7});
  });vi.stubGlobal('fetch',fetch);
  const first=render(<StrictMode><FollowUpRequestForm {...props}/></StrictMode>);await flush();fill();fireEvent.click(screen.getByRole('button',{name:'요청 접수'}));await flush();
  expect(screen.getByRole('alert').textContent).toContain('네트워크 응답 없음');first.unmount();
  render(<FollowUpRequestForm {...props}/>);await flush();expect(sent).toHaveLength(1);expect((screen.getByLabelText('요청 메모') as HTMLTextAreaElement).value).toContain('\n');
  fireEvent.click(screen.getByRole('button',{name:'동일 요청 접수 확인'}));await flush();expect(sent).toHaveLength(2);expect(sent[1]).toEqual(sent[0]);expect(sessionStorage.getItem(key)).toBeNull();expect(props.onCreated).toHaveBeenCalledWith({id:7});
  expect(new Headers(fetch.mock.calls[0][1]?.headers).get('X-Organization-ID')).toBe('org-a');
});
it('recovers an already created request with a read and never resends it',async()=>{
  sessionStorage.setItem(key,JSON.stringify({queueCode:'q',actionType:'CALLBACK',title:'확인',details:'메모',requestId:'abcdefab-1234-4123-8123-abcdefabcdef'}));
  const fetch=vi.fn<(path:string)=>Promise<Response>>(async()=>response({id:9,status:'SCHEDULED'}));vi.stubGlobal('fetch',fetch);
  render(<FollowUpRequestForm {...props}/>);await flush();expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'동일 요청 접수 확인'}));await flush();expect(fetch).toHaveBeenCalledOnce();expect(fetch.mock.calls[0][0]).toContain('/request/');expect(props.onCreated).toHaveBeenCalledWith({id:9,status:'SCHEDULED'});
});
it('does not send when storage fails or whitespace input trims to empty',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<FollowUpRequestForm {...props}/>);await flush();fill();
  const original=Storage.prototype.setItem;vi.spyOn(Storage.prototype,'setItem').mockImplementation(function(this:Storage,k,v){if(k===key)throw new Error('저장소 가득 참');return original.call(this,k,v);});
  fireEvent.click(screen.getByRole('button',{name:'요청 접수'}));await flush();expect(fetch).not.toHaveBeenCalled();expect((screen.getByLabelText('요청 목적') as HTMLInputElement).value).toBe('견적 확인');
  fireEvent.change(screen.getByLabelText('요청 목적'),{target:{value:'  '}});fireEvent.click(screen.getByRole('button',{name:'요청 접수'}));await flush();expect(fetch).not.toHaveBeenCalled();
});
it('allows correcting a definitively rejected request while retaining its input',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>response({detail:'희망 시각이 과거입니다.'},400)));
  render(<FollowUpRequestForm {...props}/>);await flush();fill();fireEvent.click(screen.getByRole('button',{name:'요청 접수'}));await flush();
  fireEvent.click(screen.getByRole('button',{name:'접수되지 않은 요청의 입력 수정'}));await flush();expect(sessionStorage.getItem(key)).toBeNull();expect((screen.getByLabelText('요청 목적') as HTMLInputElement).value).toBe('견적 확인');expect((screen.getByLabelText('요청 목적') as HTMLInputElement).disabled).toBe(false);
});
