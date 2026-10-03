import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {useSupportSession} from './use-support-session';
import {storeSupportRequest, supportStorageKey, type SupportRequest, type SupportSession} from '@/lib/support-session';

const payload:SupportRequest = {organizationCode:'org-a', requestId:'dc77d3a9-4a6a-453e-aec9-bf6c5f34e0af', customerName:'고객',
  phoneNumber:'01000000000', customerType:'INDIVIDUAL', inquiryType:'제품 문의', message:'원래 문의', channel:'CHAT'};
const waiting:SupportSession = {sessionId:'opaque-session', queueCode:'q-one', status:'WAITING', channel:'CHAT', assignedAgent:'', waitingCount:3, expiresAt:'2026-10-04T00:00:00Z'};
const response = (data:unknown = waiting, status = 200) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json'}});
const flush = async () => {await act(async () => {await Promise.resolve(); await Promise.resolve();});};
beforeEach(() => {sessionStorage.clear();});
afterEach(() => {cleanup(); vi.unstubAllGlobals();});

it('reload recovers the existing request without creating work and restores its original body', async () => {
  storeSupportRequest(payload);
  const fetcher=vi.fn<(url:string, options?:RequestInit)=>Promise<Response>>(async () => response()); vi.stubGlobal('fetch', fetcher);
  const {result}=renderHook(() => useSupportSession('org-a'));
  await waitFor(() => expect(result.current.step).toBe('WAITING'));
  expect(result.current.request?.message).toBe('원래 문의');
  expect(fetcher.mock.calls[0][0]).toBe(`/api/support/request/org-a/${payload.requestId}`);
  expect(fetcher.mock.calls.every(call => call[1]?.method !== 'POST')).toBe(true);
});

it('unknown POST outcome keeps the exact request ID and body across reload and retry', async () => {
  const bodies:SupportRequest[]=[];
  vi.stubGlobal('fetch',vi.fn(async (url:string, options?:RequestInit) => {
    if (options?.method === 'POST') {bodies.push(JSON.parse(options.body as string)); if (bodies.length === 1) throw new TypeError('Network failed'); return response();}
    return url.includes('/request/') ? response({},404) : response();
  }));
  const first=renderHook(() => useSupportSession('org-a')); await waitFor(() => expect(first.result.current.step).toBe('FORM'));
  await act(() => first.result.current.submit(payload)); expect(first.result.current.step).toBe('PENDING'); first.unmount();
  const second=renderHook(() => useSupportSession('org-a')); await waitFor(() => expect(second.result.current.step).toBe('PENDING'));
  await act(() => second.result.current.submit({...payload,message:'변경하려던 문의'}));
  expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]); expect(bodies[1].message).toBe('원래 문의');
  expect(second.result.current.step).toBe('WAITING');
});

it('uncertain retry recovers original success before attempting another POST', async () => {
  storeSupportRequest(payload); let calls=0;
  const fetcher=vi.fn<(url:string, options?:RequestInit)=>Promise<Response>>(async () => ++calls===1 ? response({},404) : response()); vi.stubGlobal('fetch',fetcher);
  const {result}=renderHook(() => useSupportSession('org-a')); await waitFor(() => expect(result.current.step).toBe('PENDING'));
  await act(() => result.current.submit());
  expect(result.current.step).toBe('WAITING'); expect(fetcher.mock.calls.every(call => call[1]?.method !== 'POST')).toBe(true);
});

it('confirmed cancellation permits a fresh request with a different UUID', async () => {
  storeSupportRequest(payload); const bodies:SupportRequest[]=[];
  vi.stubGlobal('fetch',vi.fn(async (url:string, options?:RequestInit) => {
    if (url.endsWith('/cancel')) return response({...waiting,status:'CANCELLED'});
    if (options?.method === 'POST') bodies.push(JSON.parse(options.body as string)); return response();
  }));
  const {result}=renderHook(() => useSupportSession('org-a')); await waitFor(() => expect(result.current.step).toBe('WAITING'));
  await act(() => result.current.cancel()); expect(result.current.step).toBe('CANCELLED');
  act(() => result.current.newRequest()); expect(sessionStorage.getItem(supportStorageKey('org-a'))).toBeNull();
  await act(() => result.current.submit(payload)); expect(bodies[0].requestId).not.toBe(payload.requestId);
});

it('cancellation failure preserves work and a later success shows actual server completion', async () => {
  storeSupportRequest(payload); let cancel=0;
  vi.stubGlobal('fetch',vi.fn(async (url:string) => url.endsWith('/cancel')
    ? (++cancel===1 ? response({},500) : response({...waiting,status:'COMPLETED'})) : response()));
  const {result}=renderHook(() => useSupportSession('org-a')); await waitFor(() => expect(result.current.step).toBe('WAITING'));
  await act(() => result.current.cancel()); expect(result.current.step).toBe('WAITING'); expect(result.current.request).toEqual(payload);
  await act(() => result.current.cancel()); expect(result.current.step).toBe('FINISHED'); expect(result.current.session?.status).toBe('COMPLETED');
});

it('expired recovery waits for explicit new submission and does not silently resubmit', async () => {
  storeSupportRequest(payload); const fetcher=vi.fn(async () => response({},410)); vi.stubGlobal('fetch',fetcher);
  const {result}=renderHook(() => useSupportSession('org-a')); await waitFor(() => expect(result.current.step).toBe('EXPIRED'));
  await act(() => result.current.submit(payload)); expect(fetcher).toHaveBeenCalledTimes(1);
  act(() => result.current.newRequest()); expect(result.current.step).toBe('FORM');
});

it('organization switch does not show a late response from the previous tenant', async () => {
  storeSupportRequest(payload); let resolve!:(value:Response)=>void;
  vi.stubGlobal('fetch',vi.fn(() => new Promise<Response>(r => {resolve=r;})));
  const {result,rerender}=renderHook(({code}) => useSupportSession(code),{initialProps:{code:'org-a'}}); await flush();
  rerender({code:'org-b'}); await waitFor(() => expect(result.current.step).toBe('FORM'));
  await act(async () => {resolve(response());}); expect(result.current.session).toBeNull(); expect(result.current.request).toBeNull();
});

it('microphone denial sends no request and stores no ambiguous session', async () => {
  const fetcher=vi.fn(); vi.stubGlobal('fetch',fetcher);
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn(async () => {throw new Error('마이크 권한 거부');})}});
  const {result}=renderHook(() => useSupportSession('org-a')); await waitFor(() => expect(result.current.step).toBe('FORM'));
  await act(() => result.current.submit({...payload,channel:'CALL'}));
  expect(fetcher).not.toHaveBeenCalled(); expect(result.current.step).toBe('FORM'); expect(sessionStorage.getItem(supportStorageKey('org-a'))).toBeNull();
});

it('late poll cannot replace the confirmed cancelled state', async () => {
  storeSupportRequest(payload); let resolve!:(value:Response)=>void;
  vi.stubGlobal('fetch',vi.fn(async (url:string) => {
    if (url.endsWith('/cancel')) return response({...waiting,status:'CANCELLED'});
    if (url.includes('/request/')) return response(); return new Promise<Response>(r => {resolve=r;});
  }));
  const {result}=renderHook(() => useSupportSession('org-a')); await waitFor(() => expect(result.current.step).toBe('WAITING')); await flush();
  await act(() => result.current.cancel()); await act(async () => {resolve(response());});
  expect(result.current.step).toBe('CANCELLED'); expect(result.current.session?.status).toBe('CANCELLED');
});
