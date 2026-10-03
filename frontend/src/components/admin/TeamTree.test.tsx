import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {TeamTree} from './TeamTree';
import type {AdminMember,AdminTeam} from '@/lib/admin';
const teams:AdminTeam[]=[{id:'root',name:'상담팀',parentId:null,active:true,version:0},{id:'child',name:'기술팀',parentId:'root',active:true,version:0}];
const members:AdminMember[]=[{id:1,subject:'alice',displayName:'김직원',active:true,teamId:'root',roleIds:['role'],permissions:['consultation:read'],dataScope:'SELF',version:3},{id:2,subject:'new',displayName:'새 직원',active:true,teamId:null,roleIds:[],permissions:[],dataScope:'SELF',version:0}];
afterEach(cleanup);
it('shows team members on selection and supports collapse and accessible team movement',async()=>{
  const move=vi.fn(async()=>true);render(<TeamTree teams={teams} members={members} busy={false} onEdit={vi.fn()} onMove={move}/>);
  expect(screen.queryByText('김직원')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'상담팀 소속 직원 보기'}));expect(screen.getByText('김직원')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'상담팀 하위 팀 접기'}));expect(screen.queryByRole('button',{name:'기술팀 소속 직원 보기'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'전체 펼치기'}));
  fireEvent.click(screen.getByRole('button',{name:'김직원 이동할 팀 선택'}));fireEvent.change(screen.getByLabelText('이동할 팀'),{target:{value:'child'}});
  fireEvent.click(screen.getByRole('button',{name:'선택한 팀으로 이동'}));await waitFor(()=>expect(move).toHaveBeenCalledWith(members[0],'child'));
});
it('moves only an internally dragged employee and keeps a failed move selection',async()=>{
  const move=vi.fn(async()=>false);render(<TeamTree teams={teams} members={members} busy={false} onEdit={vi.fn()} onMove={move}/>);
  const dataTransfer={effectAllowed:'',dropEffect:'',setData:vi.fn()};
  const target=screen.getByRole('button',{name:'기술팀 소속 직원 보기'}).parentElement!;
  fireEvent.drop(target,{dataTransfer});expect(move).not.toHaveBeenCalled();
  fireEvent.dragStart(screen.getByText('새 직원').parentElement!,{dataTransfer});fireEvent.dragOver(target,{dataTransfer});fireEvent.drop(target,{dataTransfer});
  await waitFor(()=>expect(move).toHaveBeenCalledWith(members[1],'child'));
  fireEvent.click(screen.getByRole('button',{name:'새 직원 이동할 팀 선택'}));fireEvent.change(screen.getByLabelText('이동할 팀'),{target:{value:'child'}});
  fireEvent.click(screen.getByRole('button',{name:'선택한 팀으로 이동'}));await waitFor(()=>expect(move).toHaveBeenCalledTimes(2));
  expect((screen.getByLabelText('이동할 팀') as HTMLSelectElement).value).toBe('child');
});
