import {afterEach,expect,it} from 'vitest';
import {koreanInput,koreanInstant,pendingRequest} from './followup';
afterEach(()=>sessionStorage.clear());
it('interprets schedule input in Korea independently of browser time zone and rejects normalized invalid dates',()=>{
  expect(koreanInstant('2026-10-03T15:30')).toBe('2026-10-03T06:30:00.000Z');
  expect(koreanInput('2026-10-03T06:30:00Z')).toBe('2026-10-03T15:30');
  expect(()=>koreanInstant('2026-02-30T10:00')).toThrow();
  expect(()=>koreanInstant('2026-10-03')).toThrow();
});
it('rejects stored requests with a changed source, nonhex UUID or unpaired time zone',()=>{
  const request={queueCode:'q',actionType:'VISIT',title:'방문',details:'점검',requestId:'abcdefab-1234-4123-8123-abcdefabcdef'};
  sessionStorage.setItem('key',JSON.stringify(request));expect(pendingRequest('key','q','VISIT')).toEqual(request);
  expect(()=>pendingRequest('key','other','VISIT')).toThrow();
  sessionStorage.setItem('key',JSON.stringify({...request,requestId:'zzzzzzzz-1234-4123-8123-abcdefabcdef'}));expect(()=>pendingRequest('key','q','VISIT')).toThrow();
  sessionStorage.setItem('key',JSON.stringify({...request,timeZone:'Asia/Seoul'}));expect(()=>pendingRequest('key','q','VISIT')).toThrow();
});
