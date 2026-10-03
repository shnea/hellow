import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueuePanel } from './QueuePanel';

afterEach(()=>{cleanup();sessionStorage.clear();vi.unstubAllGlobals();});
it('routes a completed callback action to history and clears history errors when returning to active work',async()=>{
  const open=vi.fn(),select=vi.fn();let fail=false;
  vi.stubGlobal('fetch',vi.fn(async()=>fail?Response.json({detail:'이력 조회 실패'},{status:503}):Response.json({items:[{code:'callback-old',type:'CALLBACK',customerType:'INDIVIDUAL',customerName:'이전 콜백',status:'COMPLETED',summary:'예약 문의'}],hasMore:false})));
  render(<QueuePanel organizationId="org" queueItems={[]} selectedQueueId="" onSelectQueueItem={select} onOpenHistory={open}/>);
  fireEvent.change(screen.getByLabelText('업무 상태'),{target:{value:'COMPLETED'}});
  fireEvent.click(await screen.findByRole('button',{name:'요청 보기'}));
  expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'callback-old'}));expect(select).not.toHaveBeenCalled();
  fail=true;fireEvent.change(screen.getByLabelText('업무 상태'),{target:{value:'CANCELLED'}});
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('업무 상태'),{target:{value:'ACTIVE'}});
  expect(screen.queryByRole('alert')).toBeNull();expect(screen.queryByRole('status')).toBeNull();
});
it('opens completed unregistered intake from a persistent empty queue and loads older history',async()=>{
  const open=vi.fn();
  const fetcher=vi.fn(async(path:string,options?:RequestInit)=>{
    expect(new Headers(options?.headers).get('X-Organization-ID')).toBe('org');
    const page=path.includes('page=1')?1:0;
    return Response.json({items:[{code:`old-${page}`,customerCode:null,type:'TICKET',customerType:'INDIVIDUAL',customerName:`미등록 고객 ${page}`,status:'COMPLETED',summary:'이전 문의',registered:false}],hasMore:page===0});
  });
  vi.stubGlobal('fetch',fetcher);
  render(<QueuePanel organizationId="org" queueItems={[]} selectedQueueId="" onSelectQueueItem={vi.fn()} onOpenHistory={open}/>);
  expect(screen.getByText('처리 대기열')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('업무 상태'),{target:{value:'COMPLETED'}});
  fireEvent.click(await screen.findByText('미등록 고객 0'));
  expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'old-0',customerCode:null}));
  fireEvent.click(screen.getByRole('button',{name:'이전 이력 더 보기'}));
  expect(await screen.findByText('미등록 고객 1')).toBeTruthy();
  expect(screen.getByText('미등록 고객 0')).toBeTruthy();
  await waitFor(()=>expect(screen.queryByText('이전 이력 더 보기')).toBeNull());
});
