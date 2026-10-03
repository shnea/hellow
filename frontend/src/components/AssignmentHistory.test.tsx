import React from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AssignmentHistory} from './AssignmentHistory';
import type {QueueItem} from '@/types';
const item={id:'queue-1',status:'WAITING',version:4,offer:null,attemptCount:2} as unknown as QueueItem;
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const flush=async()=>{await act(async()=>{await Promise.resolve();await Promise.resolve();});};
function open(container:HTMLElement){const details=container.querySelector('details')!;details.open=true;fireEvent(details,new Event('toggle'));}
it('retries an unavailable history and offers explicit routing restart alongside preserved outcomes',async()=>{
  sessionStorage.setItem('hellow_access_token','test');sessionStorage.setItem('hellow_organization_id','org-a');
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({detail:'History unavailable'}),{status:503}))
    .mockResolvedValueOnce(new Response(JSON.stringify([{id:'attempt-1',agentName:'Alice',outcome:'REJECTED',routingCycle:0,offeredAt:'2026-10-03T01:00:00Z',finishedAt:'2026-10-03T01:00:05Z'}]),{status:200}));
  vi.stubGlobal('fetch',fetch);const restart=vi.fn();const view=render(<AssignmentHistory item={item} busy={false} canRestart onRestart={restart}/>);
  open(view.container);await flush();expect(screen.getByRole('alert').textContent).toContain('History unavailable');
  fireEvent.click(screen.getByRole('button',{name:'이력 다시 조회'}));await flush();expect(screen.getByText('Alice · 상담 거절')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'배정 다시 시작'}));expect(restart).toHaveBeenCalledOnce();
  expect(new Headers(fetch.mock.calls[0][1].headers).get('X-Organization-ID')).toBe('org-a');
});
it('aborts old queue history before switching requests and suppresses stale results',async()=>{
  let signal:AbortSignal|undefined;let oldResolve:(r:Response)=>void=()=>{};
  const fetch=vi.fn((url:string,options:RequestInit)=>{if(url.includes('queue-1')){signal=options.signal as AbortSignal;return new Promise<Response>(r=>oldResolve=r);}return Promise.resolve(new Response('[]'));});
  vi.stubGlobal('fetch',fetch);const view=render(<AssignmentHistory item={item} busy={false} canRestart={false} onRestart={()=>{}}/>);open(view.container);await flush();
  view.rerender(<AssignmentHistory item={{...item,id:'queue-2'}} busy={false} canRestart={false} onRestart={()=>{}}/>);await flush();expect(signal?.aborted).toBe(true);
  await act(async()=>oldResolve(new Response(JSON.stringify([{id:'old',agentName:'Stale Agent',outcome:'REJECTED',routingCycle:0,offeredAt:'2026-10-03T01:00:00Z'}]))));await flush();
  expect(screen.queryByText(/Stale Agent/)).toBeNull();expect(screen.queryByRole('button',{name:'배정 다시 시작'})).toBeNull();
});
