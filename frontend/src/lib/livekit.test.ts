import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {LiveKitCallSession} from './livekit';
const mocks=vi.hoisted(()=>({events:new Map<string,(...a:unknown[])=>void>(),mic:vi.fn(async()=>{}),disconnect:vi.fn(),connect:vi.fn(async()=>{}),playback:false,startAudio:vi.fn(async()=>{}),capture:vi.fn(),publish:vi.fn(async()=>{}),mute:vi.fn(async()=>{}),stop:vi.fn()}));
vi.mock('livekit-client',()=>({
 Room:class {localParticipant={setMicrophoneEnabled:mocks.mic,publishTrack:mocks.publish};state='connected';get canPlaybackAudio(){return mocks.playback;}startAudio=mocks.startAudio;on(event:string,cb:(...a:unknown[])=>void){mocks.events.set(event,cb);return this;}connect=mocks.connect;disconnect=mocks.disconnect;},
 RoomEvent:{ConnectionStateChanged:'state',Connected:'connected',Reconnected:'reconnected',AudioPlaybackStatusChanged:'playback',Disconnected:'disconnected',TrackSubscribed:'subscribe',TrackUnsubscribed:'unsubscribe',ActiveSpeakersChanged:'speakers'},
 Track:{Kind:{Audio:'audio'},Source:{Microphone:'microphone'}},createLocalAudioTrack:mocks.capture,ConnectionState:{Connected:'connected'},DisconnectReason:{DUPLICATE_IDENTITY:'duplicate'},
}));
beforeEach(()=>{vi.clearAllMocks();mocks.capture.mockResolvedValue({mute:mocks.mute,stop:mocks.stop});});
afterEach(()=>{document.body.replaceChildren();mocks.events.clear();vi.restoreAllMocks();mocks.connect.mockResolvedValue(undefined);mocks.mic.mockResolvedValue(undefined);mocks.playback=false;mocks.startAudio.mockReset();});
it('keeps customer audio when the former agent leaves and removes every remaining track on disposal',async()=>{
 vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
 const call=new LiveKitCallSession();await call.connect('wss://media','fixture-token');
 function track(identity:string){const element=document.createElement('audio');const audio={kind:'audio',attach:()=>element,detach:vi.fn()};mocks.events.get('subscribe')!(audio,{}, {identity});return {element,audio};}
 const source=track('source'),customer=track('customer'),target=track('target');
 mocks.events.get('unsubscribe')!(source.audio);
 expect(source.element.isConnected).toBe(false);expect(customer.element.isConnected).toBe(true);expect(target.element.isConnected).toBe(true);
 expect(mocks.capture).toHaveBeenCalledTimes(1);expect(mocks.stop).not.toHaveBeenCalled();expect(mocks.connect).toHaveBeenCalledTimes(1);
 call.disconnect();expect(customer.element.isConnected).toBe(false);expect(target.element.isConnected).toBe(false);expect(customer.audio.detach).toHaveBeenCalled();
});
it('reports a recoverable Korean connection error without exposing the SDK message',async()=>{
 mocks.connect.mockRejectedValue(new Error('could not establish pc connection'));
 const onError=vi.fn();const call=new LiveKitCallSession({onError});
 await expect(call.connect('wss://media','fixture-token')).rejects.toThrow('네트워크를 확인한 뒤 다시 연결');
 expect(onError.mock.calls.at(-1)?.[0].message).not.toContain('pc connection');expect(mocks.disconnect).toHaveBeenCalled();
});
it('explains microphone permission rejection before attempting the media connection',async()=>{
 mocks.capture.mockRejectedValue(new DOMException('Permission denied','NotAllowedError'));
 const connected=vi.fn();const call=new LiveKitCallSession({onConnected:connected});await expect(call.connect('wss://media','fixture-token')).rejects.toThrow('브라우저의 마이크 권한');expect(connected).not.toHaveBeenCalled();
 expect(mocks.connect).not.toHaveBeenCalled();
});
it('reports autoplay blocking and starts audio immediately from the user action',async()=>{
 const changed=vi.fn();const call=new LiveKitCallSession({onAudioPlaybackChanged:changed});await call.connect('wss://media','fixture-token');
 expect(changed).toHaveBeenLastCalledWith(false);
 mocks.startAudio.mockImplementation(async()=>{mocks.playback=true;});
 const action=call.startAudio();expect(mocks.startAudio).toHaveBeenCalledTimes(1);await action;
 expect(changed).toHaveBeenLastCalledWith(true);
});
it('keeps the microphone disabled when restoring a muted session',async()=>{
 const call=new LiveKitCallSession();await call.connect('wss://media','fixture-token',true);
 expect(mocks.capture.mock.invocationCallOrder[0]).toBeLessThan(mocks.connect.mock.invocationCallOrder[0]);
 expect(mocks.mute.mock.invocationCallOrder[0]).toBeLessThan(mocks.publish.mock.invocationCallOrder[0]);
 expect(mocks.publish).toHaveBeenCalledWith(expect.objectContaining({stop:mocks.stop}),{source:'microphone'});
 call.disconnect();expect(mocks.stop).toHaveBeenCalled();
});
it('stops late microphone permission results after cancellation without connecting',async()=>{
 let grant:(track:unknown)=>void=()=>{};mocks.capture.mockImplementation(()=>new Promise(resolve=>{grant=resolve;}));
 const call=new LiveKitCallSession();const connecting=call.connect('wss://media','fixture-token');call.disconnect();grant({mute:mocks.mute,stop:mocks.stop});
 await expect(connecting).rejects.toThrow();expect(mocks.stop).toHaveBeenCalled();expect(mocks.connect).not.toHaveBeenCalled();expect(mocks.publish).not.toHaveBeenCalled();
});
