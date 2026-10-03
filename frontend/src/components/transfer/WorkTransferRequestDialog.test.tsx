import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {WorkTransferRequestDialog} from './WorkTransferRequestDialog';
import {pendingTransfer,transferPendingKey} from '@/lib/work-transfer';
const key=transferPendingKey('org','issuer','one',7);
const props={source:{id:7,version:1,name:'검수 고객',liveWork:false},organizationId:'org',issuer:'issuer',subject:'one',accessKey:'write',allowed:true,onClose:vi.fn(),onCreated:vi.fn()};
const frozen={consultationId:7,expectedRecordVersion:1,toMemberId:2,reason:'복원 사유',memo:'복원 메모',requestId:'abcdefab-1234-4123-8123-abcdefabcdef'};
const result={id:'12345678-1234-4123-8123-abcdefabcdef',organizationId:'org',consultationId:7,version:1,status:'OFFERED'};
const flush=async()=>{await act(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();});};
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};sessionStorage.clear();vi.clearAllMocks();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('restores a submitted request without posting on open and checks the original UUID first',async()=>{
  sessionStorage.setItem(key,JSON.stringify(frozen));const fetch=vi.fn(async(path:string)=>Response.json(path.includes('/assignees')?[{memberId:2,name:'받는 직원'}]:result));vi.stubGlobal('fetch',fetch);
  render(<WorkTransferRequestDialog {...props}/>);await flush();expect((screen.getByLabelText('이관 사유') as HTMLTextAreaElement).value).toBe('복원 사유');expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button',{name:'동일 요청 결과 확인'}));await flush();expect(fetch.mock.calls[1][0]).toBe('/api/transfers/request/'+frozen.requestId);expect(props.onCreated).toHaveBeenCalledWith(result);expect(sessionStorage.getItem(key)).toBeNull();
});
it('keeps an unsent reason and memo when the dialog is closed and reopened',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json([{memberId:2,name:'받는 직원'}])));const view=render(<WorkTransferRequestDialog {...props}/>);await flush();fireEvent.change(screen.getByLabelText('이관 사유'),{target:{value:'아직 보내지 않은 사유'}});fireEvent.change(screen.getByLabelText(/전달할 메모/),{target:{value:'메모 유지'}});
  view.rerender(<WorkTransferRequestDialog {...props} source={null}/>);await flush();view.rerender(<WorkTransferRequestDialog {...props}/>);await flush();expect((screen.getByLabelText('이관 사유') as HTMLTextAreaElement).value).toBe('아직 보내지 않은 사유');expect((screen.getByLabelText(/전달할 메모/) as HTMLTextAreaElement).value).toBe('메모 유지');
});
it('freezes input after an uncertain POST and resends the stored request only after empty recovery',async()=>{
  const commands:unknown[]=[];let lost=true;
  vi.stubGlobal('fetch',vi.fn(async(path:string,o?:RequestInit)=>{if(path.includes('/assignees'))return Response.json([{memberId:2,name:'받는 직원'}]);if(path.includes('/request/'))return new Response('');commands.push(JSON.parse(o!.body as string));if(lost){lost=false;throw new TypeError('응답 유실');}return Response.json(result);}));
  render(<WorkTransferRequestDialog {...props}/>);await flush();fireEvent.change(screen.getByLabelText('대상 직원'),{target:{value:'2'}});fireEvent.change(screen.getByLabelText('이관 사유'),{target:{value:'전송 사유'}});fireEvent.click(screen.getByRole('button',{name:'이관 요청'}));await flush();
  const saved=pendingTransfer(key,7);expect(saved?.reason).toBe('전송 사유');expect((screen.getByLabelText('이관 사유').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'동일 요청 결과 확인'}));await flush();expect(commands).toEqual([saved,saved]);expect(props.onCreated).toHaveBeenCalledTimes(1);
});
it('does not discard a pending request or create another when recovering it is denied',async()=>{
  sessionStorage.setItem(key,JSON.stringify(frozen));const fetch=vi.fn(async(path:string)=>path.includes('/assignees')?Response.json([]):Response.json({detail:'현재 권한 회수'},{status:403}));vi.stubGlobal('fetch',fetch);
  render(<WorkTransferRequestDialog {...props}/>);await flush();fireEvent.click(screen.getByRole('button',{name:'동일 요청 결과 확인'}));await flush();expect(pendingTransfer(key,7)).toEqual(frozen);expect(props.onCreated).not.toHaveBeenCalled();expect(screen.getByRole('alert').textContent).toContain('현재 권한 회수');
});
