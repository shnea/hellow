import {render,screen,fireEvent,waitFor,act,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {ReportingWorkspace} from './ReportingWorkspace';
import {ApiError,apiJson} from '@/lib/api';
vi.mock('@/lib/api',()=>({apiJson:vi.fn(),ApiError:class extends Error{constructor(public status:number,message:string){super(message);}}}));
const section=(totals:Record<string,number>)=>({totals,items:[],hasMore:false,page:0});
const fixture={asOf:'2026-10-04T03:00:00Z',scope:'SELF',report:{
  queues:section({received:3,accepted:2,connected:1,unconnected:1,automatic_callbacks:1,unregistered:3,measured_waits:1,unmeasured_waits:1,wait_seconds:30,current_wait_seconds:60,call_seconds:120,ongoing_calls:0}),
  records:section({records:1,completed:1}),attempts:[{label:'MISSED',count:1}],transfers:{accepted:1},
  trends:{...section({received:3}),items:[{key:'2026-10-04',label:'2026-10-04',received:3,accepted:2,connected:1}]},
  channels:{...section({received:3}),items:[{key:'CALL',label:'CALL',received:2},{key:'TICKET',label:'TICKET',received:1}]},
}};
const props={active:true,organizationId:'a',accessKey:'self',canMonitor:true,canReport:true,canReadHistory:false,onHistory:vi.fn()};
const api=vi.mocked(apiJson);
beforeEach(()=>{api.mockReset();props.onHistory.mockReset();api.mockImplementation(async path=>{
  if(path.endsWith('options'))return {members:[{id:1,name:'상담사(상담사아이디)',teamId:'t'}],teams:[{id:'t',name:'상담팀'}],categories:[{id:'c',name:'["일반","문의"]'}],results:[{id:'r',name:'해결'}],scope:'SELF',hasMore:false};
  if(path.startsWith('/api/reports/consultations'))return fixture;
  if(path.startsWith('/api/reports/followups'))return {asOf:fixture.asOf,report:section({callbacks:1,pending:1})};
  if(path.startsWith('/api/monitoring/agents'))return {asOf:fixture.asOf,scope:'SELF',items:[{memberId:1,name:'상담사(상담사아이디)',teamId:'t',state:'AWAY',leaseExpired:false,heartbeatAt:fixture.asOf}],hasMore:false,page:0};
  if(path==='/api/monitoring/summary')return {asOf:fixture.asOf,scope:'SELF',queues:[],callbacks:[]};
  throw new Error(path);
});});
afterEach(()=>{cleanup();vi.useRealTimers();});
describe('권한별 상담 통계',()=>{
  it('정의·측정 불가·분리된 원천을 표시하고 원문 권한 없으면 이력 버튼을 숨긴다',async()=>{
    render(<ReportingWorkspace {...props}/>);await screen.findByText('접수·통화');
    expect(screen.getByRole('heading',{name:'상담 문서'})).toBeTruthy();expect(screen.getByRole('heading',{name:'콜백 처리'})).toBeTruthy();
    expect(screen.getByText('측정 1건 · 과거 미측정 1건')).toBeTruthy();expect(screen.getByText('미수신')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'상담 이력 열기'})).toBeNull();
  });
  it('조건 적용은 한국 시간·종료일 다음 자정과 모든 선택 값을 서버에 전달한다',async()=>{
    render(<ReportingWorkspace {...props}/>);await screen.findByText('접수·통화');
    fireEvent.change(screen.getByLabelText('시작일'),{target:{value:'2026-10-01'}});fireEvent.change(screen.getByLabelText('종료일'),{target:{value:'2026-10-04'}});
    fireEvent.change(screen.getByLabelText('팀'),{target:{value:'t'}});fireEvent.change(screen.getByLabelText('담당자'),{target:{value:'1'}});
    fireEvent.change(screen.getByLabelText('채널'),{target:{value:'CALL'}});fireEvent.change(screen.getByLabelText('상담 분류'),{target:{value:'c'}});fireEvent.change(screen.getByLabelText('상담 결과'),{target:{value:'r'}});fireEvent.change(screen.getByLabelText('표 구분'),{target:{value:'AGENT'}});
    fireEvent.click(screen.getByRole('button',{name:'조건 적용'}));
    await waitFor(()=>expect(api.mock.calls.some(([path])=>path.includes('from=2026-10-01')&&path.includes('until=2026-10-05')&&path.includes('memberId=1')&&path.includes('categoryId=c')&&path.includes('timeZone=Asia%2FSeoul')&&path.includes('groupBy=AGENT'))).toBe(true));
  });
  it('현황 권한만 있으면 직원 API만 호출한다',async()=>{
    render(<ReportingWorkspace {...props} canReport={false}/>);await screen.findByText('상담사(상담사아이디)');
    expect(screen.queryByText('기간 통계')).toBeNull();expect(api.mock.calls.every(([path])=>path.startsWith('/api/monitoring/'))).toBe(true);
    expect(screen.getByText('자리비움')).toBeTruthy();
  });
  it('갱신 장애는 마지막 결과를 보존하고 재시도로 복구한다',async()=>{
    render(<ReportingWorkspace {...props}/>);await screen.findByText('접수·통화');
    const normal=api.getMockImplementation()!;api.mockRejectedValue(new Error('일시 장애'));
    fireEvent.click(screen.getByRole('button',{name:'새로고침'}));await screen.findByText(/마지막 성공 결과를 표시/);
    expect(screen.getByText('접수·통화')).toBeTruthy();api.mockImplementation(normal);
    fireEvent.click(screen.getAllByRole('button',{name:'다시 조회'})[0]);await waitFor(()=>expect(screen.queryByText(/마지막 성공 결과를 표시/)).toBeNull());
  });
  it('403에는 이전 집계를 지우고 권한 변화 뒤 늦은 응답을 버린다',async()=>{
    const {rerender}=render(<ReportingWorkspace {...props}/>);await screen.findByText('접수·통화');
    api.mockRejectedValue(new ApiError(403,'조회 권한 회수'));fireEvent.click(screen.getByRole('button',{name:'새로고침'}));
    await waitFor(()=>expect(screen.queryByText('접수·통화')).toBeNull());expect(screen.getAllByText(/조회 권한 회수/).length).toBeGreaterThan(0);
    let resolve!:(v:unknown)=>void;api.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    rerender(<ReportingWorkspace {...props} accessKey="new"/>);rerender(<ReportingWorkspace {...props} accessKey="new" active={false}/>);
    await act(async()=>resolve?.(fixture));expect(screen.queryByText('접수·통화')).toBeNull();
  });
  it('원문 권한이 있을 때 이력 연결만 요청하며 화면을 임의 교체하지 않는다',async()=>{
    render(<ReportingWorkspace {...props} canReadHistory/>);await screen.findByText('접수·통화');fireEvent.click(screen.getByRole('button',{name:'상담 이력 열기'}));expect(props.onHistory).toHaveBeenCalledOnce();
  });
});
