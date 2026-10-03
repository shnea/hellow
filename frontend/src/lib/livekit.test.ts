import {afterEach,expect,it,vi} from 'vitest';
import {LiveKitCallSession} from './livekit';
const mocks=vi.hoisted(()=>({events:new Map<string,(...a:unknown[])=>void>(),mic:vi.fn(async()=>{}),disconnect:vi.fn(),connect:vi.fn(async()=>{})}));
vi.mock('livekit-client',()=>({
 Room:class {localParticipant={setMicrophoneEnabled:mocks.mic};state='connected';on(event:string,cb:(...a:unknown[])=>void){mocks.events.set(event,cb);return this;}connect=mocks.connect;disconnect=mocks.disconnect;},
 RoomEvent:{ConnectionStateChanged:'state',Connected:'connected',Disconnected:'disconnected',TrackSubscribed:'subscribe',TrackUnsubscribed:'unsubscribe',ActiveSpeakersChanged:'speakers'},
 Track:{Kind:{Audio:'audio'}},ConnectionState:{Connected:'connected'},DisconnectReason:{DUPLICATE_IDENTITY:'duplicate'},
}));
afterEach(()=>{document.body.replaceChildren();mocks.events.clear();vi.restoreAllMocks();mocks.connect.mockResolvedValue(undefined);mocks.mic.mockResolvedValue(undefined);});
it('keeps customer audio when the former agent leaves and removes every remaining track on disposal',async()=>{
 vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
 const call=new LiveKitCallSession();await call.connect('wss://media','fixture-token');
 function track(identity:string){const element=document.createElement('audio');const audio={kind:'audio',attach:()=>element,detach:vi.fn()};mocks.events.get('subscribe')!(audio,{}, {identity});return {element,audio};}
 const source=track('source'),customer=track('customer'),target=track('target');
 mocks.events.get('unsubscribe')!(source.audio);
 expect(source.element.isConnected).toBe(false);expect(customer.element.isConnected).toBe(true);expect(target.element.isConnected).toBe(true);
 call.disconnect();expect(customer.element.isConnected).toBe(false);expect(target.element.isConnected).toBe(false);expect(customer.audio.detach).toHaveBeenCalled();
});
it('reports a recoverable Korean connection error without exposing the SDK message',async()=>{
 mocks.connect.mockRejectedValue(new Error('could not establish pc connection'));
 const onError=vi.fn();const call=new LiveKitCallSession({onError});
 await expect(call.connect('wss://media','fixture-token')).rejects.toThrow('네트워크를 확인한 뒤 다시 연결');
 expect(onError.mock.calls.at(-1)?.[0].message).not.toContain('pc connection');expect(mocks.disconnect).toHaveBeenCalled();
});
it('explains microphone permission rejection after the room connects',async()=>{
 mocks.mic.mockRejectedValue(new DOMException('Permission denied','NotAllowedError'));
 const call=new LiveKitCallSession();await expect(call.connect('wss://media','fixture-token')).rejects.toThrow('브라우저의 마이크 권한');
});
