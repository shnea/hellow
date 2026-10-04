import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {InternalConversation} from './InternalConversation';
import {workJson,internalEvents} from '@/lib/team-collaboration';
import {chatImageOutbox} from '@/lib/chat-image-outbox';
vi.mock('@/lib/team-collaboration',async()=>({...await vi.importActual('@/lib/team-collaboration'),workJson:vi.fn(),workUpload:vi.fn(),internalEvents:vi.fn()}));
vi.mock('@/lib/chat-image-outbox',()=>({chatImageOutbox:vi.fn()}));
const room={id:'room',version:1,kind:'DIRECT',name:'동료',sequence:2,unread:2,preview:'안녕',participants:[{id:1,name:'나',readSequence:0,owner:true},{id:2,name:'동료',readSequence:0,owner:false}],manageable:false,updatedAt:'2026-10-04T00:00:00Z'};
const message=(sequence:number,own:boolean)=>({sequence,own,body:own?'내 원문':'상대 원문',senderName:own?'나':'동료',clientMessageId:`uuid-${sequence}`,attachments:[],createdAt:room.updatedAt});
const props={roomId:'room',organizationId:'a',storageKey:'internal-test',active:true,canWrite:true,onRoom:vi.fn()};
const api=vi.mocked(workJson),events=vi.mocked(internalEvents);
beforeEach(()=>{sessionStorage.clear();api.mockReset();events.mockReset();vi.mocked(chatImageOutbox).mockResolvedValue(null);api.mockImplementation(async(path)=>path.endsWith('/read')?room:{room,messages:[message(1,true),message(2,false)],cursor:2,hasMore:false});events.mockImplementation(()=>new Promise(()=>{}));});
afterEach(()=>{cleanup();vi.useRealTimers();});
it('서버 own 기준으로 상대 왼쪽·내 메시지 오른쪽을 적용한다',async()=>{
 render(<InternalConversation {...props}/>);expect((await screen.findByText('내 원문')).closest('article')?.classList.contains('chat-own')).toBe(true);expect(screen.getByText('상대 원문').closest('article')?.classList.contains('chat-peer')).toBe(true);
});
it('응답 유실과 새로고침 뒤 원문과 같은 UUID로 재시도한다',async()=>{
 const {unmount}=render(<InternalConversation {...props}/>);await screen.findByText('상대 원문');fireEvent.change(screen.getByLabelText('메시지'),{target:{value:'한 번만 저장'}});
 let failed=true;api.mockImplementation(async(path,org,options)=>{expect(org).toBe("a");if(options?.method==='POST'&&path.endsWith('/messages')){if(failed)throw new Error('응답 유실');return {...message(3,true),body:'한 번만 저장'};}return {room,messages:[],cursor:2,hasMore:false};});
 fireEvent.click(screen.getByRole('button',{name:'메시지 전송'}));await screen.findByRole('button',{name:'같은 전송 재시도'});const first=api.mock.calls.find(([path,org,opts])=>org==="a"&&path.endsWith('/messages')&&opts?.method==='POST')![2]!.body;
 unmount();render(<InternalConversation {...props}/>);await screen.findByRole('button',{name:'같은 전송 재시도'});failed=false;fireEvent.click(screen.getByRole('button',{name:'같은 전송 재시도'}));await screen.findByText('한 번만 저장');const calls=api.mock.calls.filter(([path,org,opts])=>org==="a"&&path.endsWith('/messages')&&opts?.method==='POST');expect(calls.at(-1)![2]!.body).toBe(first);await waitFor(()=>expect(JSON.parse(sessionStorage.getItem(props.storageKey)!).pending).toBeNull());
});
it('비활성 메뉴에서는 읽음 쓰기를 수행하지 않는다',async()=>{
 vi.useFakeTimers();const {rerender}=render(<InternalConversation {...props} active={false}/>);await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});expect(api).not.toHaveBeenCalled();rerender(<InternalConversation {...props}/>);await act(async()=>{await vi.advanceTimersByTimeAsync(1);});rerender(<InternalConversation {...props} active={false}/>);api.mockClear();await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(api.mock.calls.some(([path])=>path.endsWith('/read'))).toBe(false);
});
