import React from 'react';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import Page from './page';
import {storeSupportRequest, type SupportRequest, type SupportSession} from '@/lib/support-session';

const media=vi.hoisted(()=>({created:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),muted:vi.fn()}));
vi.mock('@/lib/livekit',()=>({LiveKitCallSession:class {
  constructor(callbacks:{onConnected:()=>void}) {media.created(callbacks);}
  connect=media.connect; disconnect=media.disconnect; setMuted=media.muted;
}}));
const request:SupportRequest={organizationCode:'org-a',requestId:'c26055ea-19b9-4823-acd6-c805076c2e0a',customerName:'검수 고객',phoneNumber:'01000000000',customerType:'INDIVIDUAL',inquiryType:'제품 문의',message:'검수 문의',channel:'CHAT'};
const session:SupportSession={sessionId:'session-one',queueCode:'queue-one',status:'PROCESSING',channel:'CHAT',assignedAgent:'실제 담당자',waitingCount:2,expiresAt:'2026-10-04T00:00:00Z'};
const branding={title:'조직 상담 안내',description:'조직별 안내 문구',buttonLabel:'문의 보내기',primaryColor:'#4f46e5',logoUrl:''};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
beforeEach(()=>{sessionStorage.clear();window.history.replaceState(null,'','/support?org=org-a');media.created.mockClear();media.connect.mockReset();media.disconnect.mockClear();media.muted.mockReset();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it('keeps the customer microphone session when a handoff changes the assigned agent',async()=>{
 storeSupportRequest({...request,channel:'CALL'});let assigned='상담사 A';
 const fetcher=vi.fn(async(url:string)=>json(url.includes('/organization/')?{name:'검수 조직',branding}:url.endsWith('/token')?{url:'wss://media',token:'synthetic'}:{...session,channel:'CALL',assignedAgent:assigned,callStartedAt:new Date(Date.now()-90000).toISOString()}));vi.stubGlobal('fetch',fetcher);
 render(<Page/>);await waitFor(()=>expect(media.connect).toHaveBeenCalledTimes(1));const initialDisconnects=media.disconnect.mock.calls.length;
 assigned='상담사 B';await waitFor(()=>expect(fetcher.mock.calls.filter(([url])=>url.endsWith('/session/session-one')).length).toBeGreaterThan(1),{timeout:3500});
 expect(media.connect).toHaveBeenCalledTimes(1);expect(media.disconnect).toHaveBeenCalledTimes(initialDisconnects);expect(fetcher.mock.calls.filter(([url])=>url.endsWith('/token'))).toHaveLength(1);
});

it('accepted online ticket shows the actual agent without voice token, microphone or media connection',async()=>{
  storeSupportRequest(request);
  const fetcher=vi.fn(async(url:string)=>json(url.includes('/organization/')?{name:'검수 조직',branding}:session));vi.stubGlobal('fetch',fetcher);
  render(<Page/>);await screen.findByRole('heading',{name:'문의 처리 중'});
  expect(screen.getByText('담당자 · 실제 담당자')).toBeTruthy();expect(media.created).not.toHaveBeenCalled();
  expect(fetcher.mock.calls.some(call=>call[0].endsWith('/token'))).toBe(false);expect(screen.queryByRole('button',{name:'통화 종료'})).toBeNull();
});

it('form sends a ticket with branding and does not claim fake estimated time or end to end encryption',async()=>{
  const posts:unknown[]=[];
  vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{
    if(url.includes('/organization/'))return json({name:'검수 조직',branding});
    if(options?.method==='POST')posts.push(JSON.parse(options.body as string));
    return json({...session,status:'WAITING'});
  }));
  render(<Page/>);await screen.findByRole('heading',{name:branding.title});
  fireEvent.change(screen.getByLabelText(/성함 \/ 담당자명/),{target:{value:'입력 고객'}});
  fireEvent.change(screen.getByLabelText(/연락처/),{target:{value:'01012345678'}});
  fireEvent.change(screen.getByLabelText('문의 요약 및 요청 사항'),{target:{value:'입력 문의'}});
  fireEvent.click(screen.getByRole('button',{name:'온라인 문의 접수'}));fireEvent.click(screen.getByRole('button',{name:branding.buttonLabel}));
  await screen.findByRole('heading',{name:'문의가 접수되었습니다'});
  expect(posts).toHaveLength(1);expect(posts[0]).toMatchObject({channel:'CHAT',customerName:'입력 고객',message:'입력 문의'});
  expect(screen.queryByText(/평균 대기|예상 대기|종단간/)).toBeNull();expect(media.created).not.toHaveBeenCalled();
});

it('voice connection failure offers reconnect and a failed server end does not disconnect the preserved call',async()=>{
  storeSupportRequest({...request,channel:'CALL'});
  media.connect.mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(url.includes('/organization/'))return json({name:'검수 조직',branding});
    if(url.endsWith('/token'))return json({url:'wss://media',token:'synthetic'});
    if(url.endsWith('/end-call'))return json({},500);
    return json({...session,channel:'CALL'});
  }));
  render(<Page/>);await screen.findByRole('button',{name:'음성 다시 연결'});
  const before=media.disconnect.mock.calls.length;fireEvent.click(screen.getByRole('button',{name:'음성 다시 연결'}));
  await waitFor(()=>expect(media.connect).toHaveBeenCalledTimes(2));
  expect(media.disconnect).toHaveBeenCalledTimes(before+1);
  await act(async()=>{media.created.mock.calls.at(-1)![0].onConnected();});
  fireEvent.click(screen.getByRole('button',{name:'통화 종료'}));await screen.findByRole('alert');
  expect(screen.getByRole('heading',{name:'음성 상담'})).toBeTruthy();expect(media.disconnect).toHaveBeenCalledTimes(before+1);
});

it('call ended is displayed separately from completed staff work and has no fake registered rating',async()=>{
  storeSupportRequest({...request,channel:'CALL'});
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>json(url.includes('/organization/')?{name:'검수 조직',branding}:{...session,channel:'CALL',status:'CALL_ENDED'})));
  render(<Page/>);await screen.findByRole('heading',{name:'통화가 종료되었습니다'});
  expect(screen.getByText(/담당자는 통화 후 상담 기록을 정리합니다/)).toBeTruthy();expect(screen.queryByText(/평가가 등록/)).toBeNull();
  expect(media.created).not.toHaveBeenCalled();
});
