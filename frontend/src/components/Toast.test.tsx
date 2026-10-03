import React from 'react';
import {act,cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ToastContainer} from './Toast';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('dismisses after 3.5 seconds even when polling replaces the parent callback',()=>{
  vi.useFakeTimers();const first=vi.fn();const latest=vi.fn();const toasts=[{id:'one',type:'success' as const,title:'저장',message:'저장 확인'}];
  const view=render(<ToastContainer toasts={toasts} onDismiss={first}/>);
  act(()=>vi.advanceTimersByTime(2500));view.rerender(<ToastContainer toasts={toasts} onDismiss={latest}/>);
  act(()=>vi.advanceTimersByTime(1000));expect(latest).toHaveBeenCalledWith('one');expect(first).not.toHaveBeenCalled();
});
