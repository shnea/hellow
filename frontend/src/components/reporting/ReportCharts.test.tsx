import {render, screen, fireEvent, cleanup, within} from '@testing-library/react';
import {afterEach, describe, it, expect} from 'vitest';
import {DailyTrend, Distribution} from './ReportCharts';

afterEach(cleanup);
describe('집계 차트', () => {
  it('빈 날짜를 0건으로 채우고 키보드로 선택한 날짜의 세 지표를 표시한다', () => {
    render(<DailyTrend from="2026-10-01" to="2026-10-03" section={{totals:{received:8}, items:[{key:'2026-10-01',label:'2026-10-01',received:8,accepted:5,connected:2}], page:0,hasMore:false}}/>);
    fireEvent.change(screen.getByLabelText('날짜별 수치'), {target:{value:'2026-10-01'}});
    expect(screen.getByText('8건')).toBeTruthy();
    expect(screen.getByText('5건')).toBeTruthy();
    expect(screen.getByText('2건')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('날짜별 수치'), {target:{value:'2026-10-02'}});
    expect(screen.getAllByText('0건')).toHaveLength(3);
  });
  it('막대 차트의 표시된 합계로 비중을 계산하고 빈 집계를 구분한다', () => {
    const {rerender}=render(<Distribution title="채널 비교" caption="같은 범위" rows={[{label:'CALL',value:3},{label:'TICKET',value:1}]}/>);
    expect(within(screen.getByRole('list')).getByText('(75.0%)')).toBeTruthy();
    expect(screen.getByText('(25.0%)')).toBeTruthy();
    rerender(<Distribution title="채널 비교" caption="같은 범위" rows={[]}/>);
    expect(screen.getByText('집계할 항목이 없습니다.')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
});
