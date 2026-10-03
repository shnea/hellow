import React from 'react';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {ConsultationHistoryWorkspace} from './ConsultationHistoryWorkspace';
vi.mock('./CustomerRecordsWorkspace',()=>({CustomerRecordsWorkspace:({onRecordSaved}:{onRecordSaved:()=>void})=><button onClick={onRecordSaved}>검수 저장</button>}));
const props={scope:'all' as const,active:true,customers:[],organizationId:'a',accessKey:'a',canRead:true,canWrite:true,canEditCustomer:true,activeQueues:{},onCustomerSaved:vi.fn()};
const rows=[{id:1,customerName:'첫 상담',phoneNumber:'01012345678',customerRegistered:false,createdAt:'2026-10-03T00:00:00Z',type:'CALL',status:'COMPLETED',memo:'저장된 내용'}];
const flush=()=>act(async()=>{await Promise.resolve();await Promise.resolve();});
beforeEach(()=>{sessionStorage.setItem('hellow_access_token','fixture');HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(()=>{cleanup();vi.unstubAllGlobals();sessionStorage.clear();});
it('opens a detail only deliberately and keeps rows and filters during a delayed save refresh',async()=>{
 let resolve:(r:Response)=>void=()=>{};let reads=0;vi.stubGlobal('fetch',vi.fn(async()=>{if(++reads===3)return new Promise<Response>(r=>{resolve=r;});return Response.json({items:rows,hasMore:false});}));
 render(<ConsultationHistoryWorkspace {...props}/>);await flush();fireEvent.change(screen.getByLabelText('고객 이름'),{target:{value:'첫'}});fireEvent.click(screen.getByRole('button',{name:'조회'}));await flush();
 const row=screen.getByText('첫 상담').closest('tr')!;fireEvent.click(row);expect(screen.queryByRole('dialog')).toBeNull();fireEvent.doubleClick(row);await flush();
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'검수 저장'}));await flush();expect(screen.getByText('저장된 내용')).toBeTruthy();expect(document.querySelector('tbody tr')).toBe(row);
 await act(async()=>resolve(Response.json({items:rows,hasMore:false})));fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'닫기'}));await flush();expect((screen.getByLabelText('고객 이름') as HTMLInputElement).value).toBe('첫');
});
it('requests server-enforced mine scope and excludes the assignee filter',async()=>{
 const fetcher=vi.fn<(path:string)=>Promise<Response>>(async()=>Response.json({items:rows,hasMore:false}));vi.stubGlobal('fetch',fetcher);render(<ConsultationHistoryWorkspace {...props} scope="mine"/>);await flush();
 expect(String(fetcher.mock.calls[0]?.[0])).toContain('scope=mine');expect(screen.queryByLabelText('담당자')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'첫 상담 상세 보기'}));await flush();expect(screen.getByRole('dialog')).toBeTruthy();
});
