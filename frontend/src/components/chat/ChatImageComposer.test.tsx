import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {ChatImageComposer} from './ChatImageComposer';
import {chatImageOutbox,type PendingChatImage} from '@/lib/chat-image-outbox';
import {sendChatImage} from '@/lib/chat';
import {SupportHttpError} from '@/lib/support-session';
vi.mock('@/lib/chat-image-outbox',()=>({chatImageOutbox:vi.fn()}));
vi.mock('@/lib/chat',()=>({sendChatImage:vi.fn()}));
const target={kind:'customer' as const,sessionId:'cap',storageKey:'image-test'};
let saved:PendingChatImage|null=null;
const mount=(canSend=true)=>render(<ChatImageComposer target={target} canSend={canSend} disabled={false} onPendingChange={vi.fn()} onSendingChange={vi.fn()} onSent={vi.fn()}/>);
beforeEach(()=>{
  saved=null;vi.mocked(sendChatImage).mockReset();vi.mocked(chatImageOutbox).mockReset().mockImplementation(async(_key,value)=>{if(value!==undefined)saved=value;return saved;});
  vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:synthetic'),revokeObjectURL:vi.fn()}));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const pick=async(container:HTMLElement,file=new File(['png-bytes'],'photo.png',{type:'image/png'}))=>{
  await waitFor(()=>expect((screen.getByRole('button',{name:'이미지 첨부'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(container.querySelector('input')!,{target:{files:[file]}});return file;
};
it('응답 유실·새로고침 뒤 원본 Blob과 같은 UUID로 재시도하고 ACK 후 보관함을 비운다',async()=>{
  vi.mocked(sendChatImage).mockRejectedValueOnce(Error('응답 유실')).mockResolvedValueOnce({sequence:2,sender:'CUSTOMER',senderName:'고객',clientMessageId:'ack',body:'',createdAt:'now',image:{name:'photo.png',mime:'image/png',size:9}});
  const pane=mount();const file=await pick(pane.container);fireEvent.click(screen.getByRole('button',{name:'이미지 전송'}));
  await screen.findByText(/응답 유실/);expect(saved?.file).toBe(file);const id=saved?.clientMessageId;pane.unmount();
  mount(false);await screen.findByRole('button',{name:'같은 이미지 재시도'});fireEvent.click(screen.getByRole('button',{name:'같은 이미지 재시도'}));
  await waitFor(()=>expect(sendChatImage).toHaveBeenCalledTimes(2));expect(vi.mocked(sendChatImage).mock.calls[1]).toEqual(vi.mocked(sendChatImage).mock.calls[0]);expect(id).toBeTruthy();await waitFor(()=>expect(saved).toBeNull());
});
it('로컬 보관 실패 때 파일을 전송하지 않고 선택한 원본을 유지한다',async()=>{
  const pane=mount();await pick(pane.container);vi.mocked(chatImageOutbox).mockRejectedValueOnce(Error('quota'));
  fireEvent.click(screen.getByRole('button',{name:'이미지 전송'}));await screen.findByText(/보관하지 못해 전송하지 않았습니다/);expect(sendChatImage).not.toHaveBeenCalled();expect(screen.getByText('photo.png · 1KB')).not.toBeNull();
});
it('SVG·초과 용량은 선택 단계에서 거부하며 취소는 전송을 만들지 않는다',async()=>{
  const pane=mount();await pick(pane.container,new File(['<svg/>'],'bad.svg',{type:'image/svg+xml'}));expect(screen.getByRole('alert').textContent).toContain('JPG·PNG');
  await pick(pane.container,new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'}));expect(screen.queryByRole('button',{name:'이미지 전송'})).toBeNull();
  await pick(pane.container);fireEvent.click(screen.getByRole('button',{name:'선택 취소'}));expect(screen.queryByRole('button',{name:'이미지 전송'})).toBeNull();expect(sendChatImage).not.toHaveBeenCalled();
});
it('서버가 잘못된 이미지라고 거부하면 보관을 취소하고 다시 선택할 수 있다',async()=>{
  vi.mocked(sendChatImage).mockRejectedValueOnce(new SupportHttpError(400,'올바른 이미지가 아닙니다.'));
  const pane=mount();await pick(pane.container);fireEvent.click(screen.getByRole('button',{name:'이미지 전송'}));
  await screen.findByText(/올바른 이미지가 아닙니다/);fireEvent.click(screen.getByRole('button',{name:'선택 취소'}));await waitFor(()=>expect(saved).toBeNull());await pick(pane.container);expect(screen.getByRole('button',{name:'이미지 전송'})).not.toBeNull();
});
