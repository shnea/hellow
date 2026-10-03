import React from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ContextActionPanel} from './ContextActionPanel';
vi.mock('./followup/FollowUpRequestForm',()=>({FollowUpRequestForm:()=>null}));
afterEach(cleanup);
function setup(){
  const quote=vi.fn();const open=vi.fn();
  render(<><textarea aria-label="현재 상담" defaultValue="작성 중인 상담"/><ContextActionPanel organizationId="org" identityKey="agent" queueCode="current"
    customerName="고객" customerPhone="010" timeline={[{id:'old',queueCode:'old',date:'2026-10-03',channel:'call',agentName:'상담사',title:'이전 통화',content:'이전 상담 전체 내용'}]}
    canQuote onOpenDetail={open} onQuoteTimeline={quote} onFollowUpCreated={()=>{}} onOpenFollowUps={()=>{}} onAddFollowUpAction={()=>{}}/></>);
  return {quote,open,card:screen.getByTitle('더블 클릭으로 상세 보기')};
}
it('opens a popup only on double click and preserves the current consultation',()=>{
  const {card,quote,open}=setup();fireEvent.click(card);expect(open).not.toHaveBeenCalled();
  fireEvent.doubleClick(card);expect(open).toHaveBeenCalledWith(expect.objectContaining({id:'old'}));
  expect((screen.getByLabelText('현재 상담') as HTMLTextAreaElement).value).toBe('작성 중인 상담');expect(quote).not.toHaveBeenCalled();
});
it('supports keyboard preview and keeps quote activation separate',()=>{
  const {card,quote,open}=setup();fireEvent.doubleClick(within(card).getByRole('button',{name:'인용'}));expect(open).not.toHaveBeenCalled();
  fireEvent.click(within(card).getByRole('button',{name:'인용'}));expect(quote).toHaveBeenCalledWith(expect.objectContaining({id:'old'}));
  fireEvent.keyDown(card,{key:'Enter'});expect(open).toHaveBeenCalled();
});
