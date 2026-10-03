import React from 'react';
import { act,cleanup,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import type {WorkTransfer} from '@/lib/work-transfer';
import { useCall } from './use-call';
const mocks=vi.hoisted(()=>({token:vi.fn<(path:string,options?:RequestInit)=>Promise<unknown>>(async()=>({url:'wss://media',token:'test'})),connect:vi.fn(),disconnect:vi.fn()}));
vi.mock('@/lib/api',async importOriginal=>({...await importOriginal<typeof import('@/lib/api')>(),apiJson:mocks.token}));
vi.mock('@/lib/livekit',()=>({LiveKitCallSession:class {connect=mocks.connect;disconnect=mocks.disconnect;setMuted=vi.fn();}}));
function Call({code,preview,identity,onChanged}:{code:string;preview?:WorkTransfer|null;identity?:string;onChanged?:(t:WorkTransfer)=>void}) {const c=useCall(code,{organizationId:preview||identity?'org':undefined,mediaIdentity:identity,transfer:preview,onTransferChanged:onChanged});return <p>{c.error||c.status}</p>;}
beforeEach(()=>{vi.clearAllMocks();mocks.token.mockResolvedValue({url:'wss://media',token:'test'});mocks.connect.mockResolvedValue(undefined);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();mocks.token.mockClear();});
it('holds a single media lease across windows and does not request a duplicate token',async()=>{
  let held=false;
  const locks={request:vi.fn(async(_name:string,_options:unknown,callback:(lock:object|null)=>Promise<void>)=>{
    if(held)return callback(null);held=true;try{return await callback({});}finally{held=false;}
  })};
  vi.stubGlobal('navigator',{locks});
  const first=render(<Call code="q-one"/>);await act(async()=>{await Promise.resolve();await Promise.resolve();});
  const second=render(<Call code="q-one"/>);await act(async()=>{await Promise.resolve();await Promise.resolve();});
  expect(mocks.token).toHaveBeenCalledTimes(1);expect(screen.getByText('다른 창에서 통화가 연결돼 있습니다. 그 창에서 통화를 진행해 주세요.')).toBeTruthy();
  second.unmount();first.unmount();await act(async()=>{await Promise.resolve();});expect(held).toBe(false);
});
const pending={id:'12345678-1234-4123-8123-abcdefabcdef',kind:'CALL',organizationId:'org',consultationId:1,queueCode:'q-one',version:1,status:'CONNECTING',targetMediaIdentity:'transfer-one'} as WorkTransfer;
function locks(){let held=false;vi.stubGlobal('navigator',{locks:{request:vi.fn(async(_n:string,_o:unknown,cb:(lock:object|null)=>Promise<void>)=>{if(held)return cb(null);held=true;try{return await cb({});}finally{held=false;}})}});return ()=>held;}
const flush=async()=>{await act(async()=>{for(let i=0;i<8;i++)await Promise.resolve();});};
it('retains the same room and media lease after a CALL preview becomes the assigned queue',async()=>{
  const held=locks();const changed=vi.fn();const accepted={...pending,status:'ACCEPTED',version:2};
  mocks.token.mockImplementation(async(path?:string)=>path?.endsWith('/media-token')?{transfer:pending,media:{url:'wss://media',token:'preview',identity:'transfer-one',roomName:'org-q-one'}}:accepted as never);
  const view=render(<Call code="q-one" preview={pending} identity="transfer-one" onChanged={changed}/>);await flush();
  expect(changed).toHaveBeenCalledWith(accepted);expect(mocks.connect).toHaveBeenCalledTimes(1);expect(held()).toBe(true);
  view.rerender(<Call code="q-one" preview={null} identity="transfer-one" onChanged={changed}/>);await flush();
  expect(mocks.connect).toHaveBeenCalledTimes(1);expect(mocks.disconnect).not.toHaveBeenCalled();expect(mocks.token).toHaveBeenCalledTimes(2);
  view.unmount();await flush();expect(held()).toBe(false);
});
it('does not connect or publish with a token for a different transfer identity',async()=>{
  locks();mocks.token.mockResolvedValue({transfer:pending,media:{url:'wss://media',token:'preview',identity:'different',roomName:'org-q-one'}} as never);
  render(<Call code="q-one" preview={pending} identity="transfer-one"/>);await flush();expect(mocks.connect).not.toHaveBeenCalled();expect(screen.getByText(/통화 담당 연결이 변경/)).toBeTruthy();
});
it('disposes the preview and releases the lease when server confirmation returns a terminal failure',async()=>{
  const held=locks();const changed=vi.fn();const failed={...pending,status:'EXPIRED',version:2};
  mocks.token.mockImplementation(async(path?:string)=>path?.endsWith('/media-token')?{transfer:pending,media:{url:'wss://media',token:'preview',identity:'transfer-one',roomName:'org-q-one'}}:failed as never);
  render(<Call code="q-one" preview={pending} identity="transfer-one" onChanged={changed}/>);await flush();expect(changed).toHaveBeenCalledWith(failed);expect(mocks.disconnect).toHaveBeenCalled();expect(held()).toBe(false);expect(screen.getByText(/기존 상담사가 통화를 계속 맡습니다/)).toBeTruthy();
});
it('does not connect when token acquisition finishes after the preview is cancelled',async()=>{
  const held=locks();let finish:(v:unknown)=>void=()=>{};mocks.token.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}) as never);
  const view=render(<Call code="q-one" preview={pending} identity="transfer-one"/>);await flush();view.unmount();
  await act(async()=>{finish({transfer:pending,media:{url:'wss://media',token:'preview',identity:'transfer-one',roomName:'org-q-one'}});});await flush();
  expect(mocks.connect).not.toHaveBeenCalled();expect(held()).toBe(false);
});
