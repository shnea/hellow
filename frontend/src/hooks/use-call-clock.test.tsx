import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {elapsedCallSeconds,useCallClock} from './use-call-clock';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('restores server time after remount and stops at the persisted end',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-04T00:02:00Z'));
 const start='2026-10-04T00:00:00Z';const first=renderHook(()=>useCallClock(start));expect(first.result.current).toBe(120);first.unmount();
 act(()=>vi.advanceTimersByTime(10000));const second=renderHook(()=>useCallClock(start));expect(second.result.current).toBe(130);
 expect(elapsedCallSeconds(start,'2026-10-04T00:01:00Z')).toBe(60);expect(elapsedCallSeconds(null)).toBe(0);
});
