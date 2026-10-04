import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {ChatPanel} from './ChatPanel';
import {chatJson,chatFetch,readChatEvents,type ChatView} from '@/lib/chat';
import {SupportHttpError} from '@/lib/support-session';
vi.mock('@/lib/chat',()=>({chatJson:vi.fn(),chatFetch:vi.fn(),readChatEvents:vi.fn()}));
vi.mock('@/lib/chat-image-outbox',()=>({chatImageOutbox:vi.fn().mockResolvedValue(null)}));
const target={kind:'customer' as const,sessionId:'capability',storageKey:'test-chat'};
const initial:ChatView={queueCode:'q',state:'OPEN',endedAt:null,canSend:true,cursor:1,hasMore:false,messages:[{sequence:1,sender:'CUSTOMER',senderName:'고객',clientMessageId:'initial',body:'처음 문의',createdAt:'2026-10-04T00:00:00Z'}]};
beforeEach(()=>{sessionStorage.clear();vi.mocked(chatJson).mockReset().mockResolvedValue(initial);vi.mocked(chatFetch).mockReset().mockResolvedValue({} as Response);vi.mocked(readChatEvents).mockReset().mockImplementation(()=>new Promise(()=>{}));});
afterEach(()=>cleanup());
it('응답 유실 뒤 같은 ID로 재시도하고 새로고침에서도 보관한 메시지를 사용한다',async()=>{
  const sends:{clientMessageId:string;body:string}[]=[];
  vi.mocked(chatJson).mockImplementation(async(_target,action,data)=>{if(action==='messages'){const value=data as typeof sends[number];sends.push(value);if(sends.length===1)throw new Error('응답 유실');return {...initial.messages[0],...value,sequence:2};}return initial;});
  const pane=render(<ChatPanel target={target}/>);await waitFor(()=>expect((screen.getByRole('textbox',{name:'메시지'}) as HTMLTextAreaElement).disabled).toBe(false));
  fireEvent.change(screen.getByRole('textbox',{name:'메시지'}),{target:{value:'재시도 원문'}});fireEvent.click(screen.getByRole('button',{name:'메시지 전송'}));
  await screen.findByRole('button',{name:'같은 메시지 재시도'});pane.unmount();
  render(<ChatPanel target={target}/>);await screen.findByRole('button',{name:'같은 메시지 재시도'});fireEvent.click(screen.getByRole('button',{name:'같은 메시지 재시도'}));
  await waitFor(()=>expect(sends).toHaveLength(2));expect(sends[1]).toEqual(sends[0]);await waitFor(()=>expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(''));expect(screen.getByText('재시도 원문')).not.toBeNull();
});
it('수신 순서대로 병합하고 종료는 대화만 닫는다',async()=>{
  let receive:((data:ChatView)=>void)|undefined;
  vi.mocked(readChatEvents).mockImplementation(async(_r,onView)=>{receive=onView;await new Promise(()=>{});});
  vi.mocked(chatJson).mockImplementation(async(_t,action)=>action==='end'?{...initial,state:'CLOSED',canSend:false,messages:[],endedAt:'2026-10-04T00:01:00Z'}:initial);
  render(<ChatPanel target={target}/>);await waitFor(()=>expect(receive).toBeDefined());
  const {act}=await import('@testing-library/react');await act(async()=>receive?.({...initial,cursor:2,messages:[{...initial.messages[0],sequence:2,sender:'AGENT',senderName:'담당자',body:'답변'},initial.messages[0]]}));
  expect(screen.getAllByText('처음 문의')).toHaveLength(1);expect(screen.getByText('답변')).not.toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'대화 종료'}));await waitFor(()=>expect(chatJson).toHaveBeenCalledWith(target,'end',{}));
});
it('브라우저 저장 실패 때 전송하지 않고 보관된 원문을 바꾸지 않는다',async()=>{
  render(<ChatPanel target={target}/>);await waitFor(()=>expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false));
  const store=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'보관할 원문'}});fireEvent.click(screen.getByRole('button',{name:'메시지 전송'}));
  expect(screen.getByRole('alert').textContent).toContain('보관하지 못했습니다');expect(chatJson).not.toHaveBeenCalledWith(target,'messages',expect.anything());store.mockRestore();
});
it('접근 회수 때 기존 메시지를 지우고 읽기 전용은 전송 폼 없이 이력 범위로 조회한다',async()=>{
  vi.mocked(chatJson).mockRejectedValue(new SupportHttpError(410,'만료'));
  const pane=render(<ChatPanel target={target}/>);await screen.findByText('대화에 접근할 수 없습니다.');expect(screen.queryByText('처음 문의')).toBeNull();pane.unmount();
  vi.mocked(chatJson).mockResolvedValue(initial);const staff={kind:'staff' as const,queueCode:'q',organizationId:'org',storageKey:'history'};
  render(<ChatPanel target={staff} readOnly/>);await screen.findByText('처음 문의');expect(screen.queryByRole('textbox')).toBeNull();expect(chatJson).toHaveBeenCalledWith(staff,'messages?afterSequence=0&history=true',undefined,expect.anything());
});
