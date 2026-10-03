import {afterEach,expect,it,vi} from 'vitest';
import {ApiError} from './api';
import {pendingTransfer,submitTransfer,transferPendingKey,type TransferRequest} from './work-transfer';

const frozen:TransferRequest={consultationId:12,expectedRecordVersion:3,toMemberId:7,reason:'인수인계',memo:'보존할 메모',requestId:'abcdefab-1234-4123-8123-abcdefabcdef'};
const response={id:'12345678-1234-4123-8123-abcdefabcdef',status:'OFFERED',organizationId:'a',consultationId:12,version:0};
afterEach(()=>{sessionStorage.clear();vi.unstubAllGlobals();});
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});}
it('scopes the pending key by issuer, organization and source, and refuses corrupt stored payloads',()=>{
  expect(transferPendingKey('a','issuer','sub',12)).not.toBe(transferPendingKey('a','other','sub',12));
  expect(transferPendingKey('a','issuer','sub',12)).not.toBe(transferPendingKey('b','issuer','sub',12));
  sessionStorage.setItem('key',JSON.stringify(frozen));expect(pendingTransfer('key',12)).toEqual(frozen);
  expect(()=>pendingTransfer('key',13)).toThrow('보관한 이관');
  for(const patch of [{toMemberId:0},{expectedRecordVersion:1.5},{reason:' '},{memo:null},{requestId:'bad-id'}]){
    sessionStorage.setItem('key',JSON.stringify({...frozen,...patch}));expect(()=>pendingTransfer('key',12)).toThrow();
  }
});
it('persists the exact UUID before transmission and keeps it when the POST response is lost',async()=>{
  const fetch=vi.fn(async(_url:string,init:RequestInit)=>{
    expect(JSON.parse(sessionStorage.getItem('key')!)).toEqual(JSON.parse(init.body as string));
    expect(new Headers(init.headers).get('X-Organization-ID')).toBe('explicit-org');
    throw new TypeError('network lost');
  });vi.stubGlobal('fetch',fetch);sessionStorage.setItem('hellow_organization_id','another-org');
  const {requestId:_,...input}=frozen;void _;
  await expect(submitTransfer('explicit-org','key',12,input)).rejects.toThrow('network lost');
  expect(pendingTransfer('key',12)).toMatchObject(input);expect(fetch).toHaveBeenCalledTimes(1);
});
it('recovers a received POST without sending a second request or dropping its terminal result',async()=>{
  sessionStorage.setItem('key',JSON.stringify(frozen));
  const fetch=vi.fn(async(url:string)=>{expect(url).toBe(`/api/transfers/request/${frozen.requestId}`);return reply({...response,status:'FAILED'});});vi.stubGlobal('fetch',fetch);
  expect((await submitTransfer('a','key',12)).status).toBe('FAILED');
  expect(fetch.mock.calls[0][0]).toBe(`/api/transfers/request/${frozen.requestId}`);
  expect(fetch).toHaveBeenCalledTimes(1);expect(sessionStorage.getItem('key')).toBeNull();
});
it('resends only the original frozen request after an empty recovery result',async()=>{
  sessionStorage.setItem('key',JSON.stringify(frozen));
  const fetch=vi.fn().mockResolvedValueOnce(new Response('')).mockResolvedValueOnce(reply(response));vi.stubGlobal('fetch',fetch);
  await submitTransfer('a','key',12);expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(frozen);
  expect(sessionStorage.getItem('key')).toBeNull();
});
it('preserves pending contents on conflict, invalid successful response, or recovery denial',async()=>{
  for(const res of [reply({detail:'충돌'},409),reply({}),reply({detail:'회수'},403)]){
    sessionStorage.setItem('key',JSON.stringify(frozen));const fetch=vi.fn(async()=>res);vi.stubGlobal('fetch',fetch);
    await expect(submitTransfer('a','key',12)).rejects.toThrow();expect(pendingTransfer('key',12)).toEqual(frozen);
    expect(fetch).toHaveBeenCalledTimes(1);
  }
});
it('never sends if storage fails or the caller tries to revise a pending request',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);sessionStorage.setItem('key',JSON.stringify(frozen));
  const {requestId:_,...input}=frozen;void _;
  await expect(submitTransfer('a','key',12,{...input,memo:'changed'})).rejects.toThrow('변경할 수 없습니다');
  sessionStorage.removeItem('key');vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('full');});
  await expect(submitTransfer('a','key',12,input)).rejects.toThrow('full');expect(fetch).not.toHaveBeenCalled();
});
it('keeps the frozen request after a rejected POST following successful empty recovery',async()=>{
  sessionStorage.setItem('key',JSON.stringify(frozen));const fetch=vi.fn().mockResolvedValueOnce(new Response('')).mockResolvedValueOnce(reply({detail:'원본 변경'},409));vi.stubGlobal('fetch',fetch);
  await expect(submitTransfer('a','key',12)).rejects.toBeInstanceOf(ApiError);expect(pendingTransfer('key',12)).toEqual(frozen);
});
it('uses a separate call request key and sends only to the CALL endpoint',async()=>{
  const key=transferPendingKey('a','issuer','sub',12,'CALL');expect(key).not.toBe(transferPendingKey('a','issuer','sub',12));
  sessionStorage.setItem(key,JSON.stringify(frozen));const fetch=vi.fn().mockResolvedValueOnce(new Response('')).mockResolvedValueOnce(reply({...response,kind:'CALL',status:'CONNECTING'}));vi.stubGlobal('fetch',fetch);
  expect((await submitTransfer('a',key,12,undefined,'CALL')).status).toBe('CONNECTING');expect(fetch.mock.calls[1][0]).toBe('/api/transfers/call');
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(frozen);expect(sessionStorage.getItem(key)).toBeNull();
});
it('preserves a frozen call request when recovery returns a WORK request with the same UUID',async()=>{
  sessionStorage.setItem('key',JSON.stringify(frozen));const fetch=vi.fn(async()=>reply({...response,kind:'WORK'}));vi.stubGlobal('fetch',fetch);
  await expect(submitTransfer('a','key',12,undefined,'CALL')).rejects.toThrow('접수 응답');expect(pendingTransfer('key',12)).toEqual(frozen);expect(fetch).toHaveBeenCalledTimes(1);
});
