import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {CallReconnectNotice} from './CallReconnectNotice';

afterEach(()=>{cleanup();vi.useRealTimers();});
it('counts down from server loss time and disappears when the call recovers or ends',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-03T20:00:12Z'));
  const {rerender}=render(<CallReconnectNotice since="2026-10-03T20:00:00Z"/>);
  expect(screen.getByRole('status').textContent).toContain('18초 남음');
  act(()=>vi.advanceTimersByTime(19000));
  expect(screen.getByRole('status').textContent).toContain('0초 남음');
  rerender(<CallReconnectNotice since="2026-10-03T20:00:00Z" ended/>);
  expect(screen.queryByRole('status')).toBeNull();
  rerender(<CallReconnectNotice since={null}/>);
  expect(screen.queryByRole('status')).toBeNull();
});
