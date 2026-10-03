import {afterEach,beforeEach,expect,it,vi} from 'vitest';
let capture:ReturnType<typeof vi.fn>;let query:ReturnType<typeof vi.fn>;let stop:ReturnType<typeof vi.fn>;
beforeEach(()=>{
  vi.resetModules();stop=vi.fn();capture=vi.fn(async()=>({getAudioTracks:()=>[{readyState:'live'}],getTracks:()=>[{stop}]}));
  query=vi.fn(async()=>({state:'granted'}));
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:capture,enumerateDevices:vi.fn(async()=>[{kind:'audioinput'}])},permissions:{query}});
});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('does not prompt during polling and releases the permission probe immediately',async()=>{
  const mic=await import('./microphone-readiness');expect(await mic.microphoneReady()).toBe(false);expect(capture).not.toHaveBeenCalled();
  await mic.prepareMicrophone();expect(stop).toHaveBeenCalledOnce();expect(await mic.microphoneReady()).toBe(true);
  query.mockResolvedValue({state:'denied'});expect(await mic.microphoneReady()).toBe(false);
});
it('keeps readiness false after denial and gives site settings guidance',async()=>{
  const mic=await import('./microphone-readiness');capture.mockRejectedValue(new DOMException('denied','NotAllowedError'));
  await expect(mic.prepareMicrophone()).rejects.toThrow('사이트 설정');expect(await mic.microphoneReady()).toBe(false);
});
it('stops a late permission grant without making the timed out agent ready',async()=>{
  vi.useFakeTimers();const mic=await import('./microphone-readiness');let resolve!:(value:unknown)=>void;
  capture.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const rejected=expect(mic.prepareMicrophone()).rejects.toThrow('기다리다 중단');await vi.advanceTimersByTimeAsync(20000);await rejected;
  resolve({getAudioTracks:()=>[{readyState:'live'}],getTracks:()=>[{stop}]});await Promise.resolve();
  expect(stop).toHaveBeenCalledOnce();expect(await mic.microphoneReady()).toBe(false);
});
