import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CustomerHistoryLinker} from './CustomerHistoryLinker';
const customer={id:'c',customerType:'individual' as const,name:'등록 고객',phoneNumber:'010-1234-5678',company:'',email:'',tier:'Standard' as const,isRegistered:true,lastContactDate:'',totalCalls:0,managerName:'',customerNotes:''};
const candidate={queueCode:'old-queue',queueVersion:2,recordVersion:3,createdAt:'2026-10-01T00:00:00Z',customerName:'접수 이름',phoneNumber:'01012345678',type:'TICKET',agentName:'직원',category:'이전 분류',result:'완료'};
let fetchMock:ReturnType<typeof vi.fn<(path:string,options?:RequestInit)=>Promise<Response>>>;
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};sessionStorage.setItem('hellow_access_token','test');sessionStorage.setItem('hellow_organization_id','a');
  fetchMock=vi.fn(async(path:string)=>Response.json(path.includes('/candidates')?{items:[candidate],hasNext:false,page:0}:[]));vi.stubGlobal('fetch',fetchMock);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('requires both selected history and explicit customer confirmation and sends displayed versions',async()=>{
  const changed=vi.fn();render(<CustomerHistoryLinker customer={customer} onChanged={changed} onClose={()=>{}}/>);await screen.findByText('접수 이름 · 01012345678');
  const connect=()=>screen.getByRole('button',{name:/선택한 \d+건 고객에 연결/});expect((connect() as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(/접수 이름 · 01012345678/));expect((connect() as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('선택한 이력이 등록 고객 고객의 이력임을 확인했습니다.'));fireEvent.click(connect());await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
  const posted=fetchMock.mock.calls.find(([,o])=>o?.method==='POST');expect(posted?.[0]).toBe('/api/customers/c/history/links');expect(JSON.parse(posted?.[1]?.body as string)).toEqual({items:[{queueCode:'old-queue',queueVersion:2,recordVersion:3}]});
});
it('preserves selected history on conflict and reloads before an explicit retry',async()=>{
  let version=3;fetchMock.mockImplementation(async(path:string,o?:RequestInit)=>o?.method?Response.json({detail:'다른 작업에서 이력이 변경됐습니다.'},{status:409}):Response.json(path.includes('/candidates')?{items:[{...candidate,recordVersion:version}],hasNext:false,page:0}:[]));
  render(<CustomerHistoryLinker customer={customer} onChanged={()=>{}} onClose={()=>{}}/>);await screen.findByText('접수 이름 · 01012345678');fireEvent.click(screen.getByLabelText(/접수 이름 · 01012345678/));fireEvent.click(screen.getByLabelText(/선택한 이력이 등록 고객/));fireEvent.click(screen.getByRole('button',{name:'선택한 1건 고객에 연결'}));await screen.findByRole('alert');
  expect((screen.getByLabelText(/접수 이름 · 01012345678/) as HTMLInputElement).checked).toBe(true);
  version=4;fireEvent.click(screen.getByRole('button',{name:'선택 유지하고 다시 조회'}));await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());fireEvent.click(screen.getByRole('button',{name:'선택한 1건 고객에 연결'}));await screen.findByRole('alert');
  expect(JSON.parse(fetchMock.mock.calls.filter(([,o])=>o?.method==='POST').at(-1)?.[1]?.body as string).items[0].recordVersion).toBe(4);
});
it('undoes only the displayed association and preserves the request version',async()=>{
  const changed=vi.fn();const linked={...candidate,id:'link-1',actorName:'연결 직원',linkedAt:'2026-10-03T00:00:00Z',undoneAt:null};
  fetchMock.mockImplementation(async(path:string,o?:RequestInit)=>o?.method?new Response(null,{status:200}):Response.json(path.includes('/candidates')?{items:[],hasNext:false,page:0}:[linked]));
  render(<CustomerHistoryLinker customer={customer} onChanged={changed} onClose={()=>{}}/>);await screen.findByRole('button',{name:'고객 연결 취소'});fireEvent.click(screen.getByRole('button',{name:'고객 연결 취소'}));await waitFor(()=>expect(changed).toHaveBeenCalledOnce());
  const posted=fetchMock.mock.calls.find(([,o])=>o?.method==='POST');expect(posted?.[0]).toBe('/api/customers/c/history/links/link-1/undo');expect(JSON.parse(posted?.[1]?.body as string)).toEqual({queueCode:'old-queue',queueVersion:2,recordVersion:3});
});
