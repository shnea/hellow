import React from 'react';
import { act,cleanup,render,screen } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { useCall } from './use-call';
const mocks=vi.hoisted(()=>({token:vi.fn(async()=>({url:'wss://media',token:'test'})),connect:vi.fn(),disconnect:vi.fn()}));
vi.mock('@/lib/api',()=>({apiJson:mocks.token}));
vi.mock('@/lib/livekit',()=>({LiveKitCallSession:class {connect=mocks.connect;disconnect=mocks.disconnect;setMuted=vi.fn();}}));
function Call({code}:{code:string}) {const c=useCall(code);return <p>{c.error||c.status}</p>;}
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
