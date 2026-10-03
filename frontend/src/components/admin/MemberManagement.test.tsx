import React from 'react';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemberManagement} from './MemberManagement';
import type {AdminMember} from '@/lib/admin';
const member:AdminMember={id:7,version:3,subject:'aa1ebd8d-7c6a-469c-be55-109a82555529',loginId:'counselor',displayName:'상담 직원',permissions:[],active:true,teamId:null,roleIds:[],dataScope:'SELF'};
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('uses nickname/login and only deletes the versioned member after confirmation',async()=>{
 const fetcher=vi.fn(async()=>new Response(null,{status:204}));vi.stubGlobal('fetch',fetcher);const reload=vi.fn(async()=>{});
 render(<MemberManagement organizationId="org" members={[member]} invitations={[]} reload={reload}/>);
 expect(screen.queryByText(member.subject)).toBeNull();expect(screen.getByText('counselor')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'상담 직원 삭제'}));const dialog=screen.getByRole('dialog');
 expect(fetcher).not.toHaveBeenCalled();fireEvent.click(within(dialog).getByRole('button',{name:'취소'}));expect(fetcher).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'상담 직원 삭제'}));await act(async()=>fireEvent.click(within(dialog).getByRole('button',{name:'직원 삭제'})));
 expect(fetcher).toHaveBeenCalledWith('/api/admin/memberships/7?expectedVersion=3',expect.objectContaining({method:'DELETE'}));expect(reload).toHaveBeenCalledOnce();
 expect(screen.getByRole('status').textContent).toContain('기존 업무 기록은 보존');
});
it('keeps the confirmation and member when active work blocks deletion',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({detail:'진행 중인 상담이 있습니다.'},{status:409})));
 const reload=vi.fn(async()=>{});render(<MemberManagement organizationId="org" members={[member]} invitations={[]} reload={reload}/>);
 fireEvent.click(screen.getByRole('button',{name:'상담 직원 삭제'}));const dialog=screen.getByRole('dialog');
 await act(async()=>fireEvent.click(within(dialog).getByRole('button',{name:'직원 삭제'})));
 expect(within(dialog).getByRole('alert').textContent).toContain('진행 중인 상담');expect(reload).not.toHaveBeenCalled();expect(screen.getByText('counselor')).toBeTruthy();
});
