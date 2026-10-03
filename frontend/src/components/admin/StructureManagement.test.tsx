import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StructureManagement } from './StructureManagement';

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('retains role input and scope choices when another administrator changed the version',async()=>{
  const fetchMock=vi.fn(async()=>Response.json({detail:'다른 창에서 변경됐습니다.'},{status:409}));
  vi.stubGlobal('fetch',fetchMock);
  const reload=vi.fn(async()=>{});
  render(<StructureManagement organizationId="org-a" teams={[]} members={[]} roles={[{id:'role-a',name:'상담사',version:1,active:true,grants:{'consultation:read':'SELF'}}]} reload={reload}/>);
  fireEvent.click(screen.getByRole('button',{name:'상담사 역할 편집'}));
  fireEvent.change(screen.getByLabelText('역할 이름'),{target:{value:'팀장'}});
  fireEvent.change(screen.getByLabelText('상담 기록 조회'),{target:{value:'TEAM'}});
  fireEvent.click(screen.getByRole('button',{name:'역할 저장'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('입력은 유지됩니다.'));
  expect((screen.getByLabelText('역할 이름') as HTMLInputElement).value).toBe('팀장');
  expect((screen.getByLabelText('상담 기록 조회') as HTMLSelectElement).value).toBe('TEAM');
  expect(reload).not.toHaveBeenCalled();
});
