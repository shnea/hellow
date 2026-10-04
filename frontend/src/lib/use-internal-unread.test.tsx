import {render,screen,waitFor,cleanup,act} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {useInternalUnread,refreshInternalUnread} from './use-internal-unread';
import {workJson} from './team-collaboration';
import {ApiError} from './api';
import {UnreadBadge} from '@/components/chat/UnreadBadge';
vi.mock('./team-collaboration',()=>({workJson:vi.fn()}));
function Probe({org='a',allowed=true}:{org?:string;allowed?:boolean}){const count=useInternalUnread(org,allowed,'actor');return <><output>{count}</output><UnreadBadge count={count}/></>;}
afterEach(()=>{cleanup();vi.mocked(workJson).mockReset();});
it('99까지만 숫자로 표시하고 100부터99+로 제한하며 읽음 반영 시 제거한다',async()=>{
 vi.mocked(workJson).mockResolvedValue({count:99});render(<Probe/>);await screen.findByLabelText('미읽음 메시지 99개');expect(screen.getByLabelText('미읽음 메시지 99개').textContent).toBe('99');
 vi.mocked(workJson).mockResolvedValue({count:100});await act(async()=>refreshInternalUnread());await screen.findByLabelText('미읽음 메시지 100개');expect(screen.getByLabelText('미읽음 메시지 100개').textContent).toBe('99+');
 vi.mocked(workJson).mockResolvedValue({count:0});await act(async()=>refreshInternalUnread());await waitFor(()=>expect(screen.queryByLabelText(/미읽음 메시지/)).toBeNull());
});
it('조직 변경 시 이전 응답을 버리고 현재 권한 회수 시 배지를 지운다',async()=>{
 let old:((value:{count:number})=>void)|undefined;vi.mocked(workJson).mockImplementation(async(_path,org)=>org==='a'?await new Promise<{count:number}>(resolve=>old=resolve):{count:2});
 const pane=render(<Probe/>);await waitFor(()=>expect(old).toBeDefined());pane.rerender(<Probe org="b"/>);await screen.findByLabelText('미읽음 메시지 2개');await act(async()=>old?.({count:80}));expect(screen.queryByLabelText('미읽음 메시지 80개')).toBeNull();
 vi.mocked(workJson).mockRejectedValue(new ApiError(403,'회수'));await act(async()=>refreshInternalUnread());await waitFor(()=>expect(screen.queryByLabelText(/미읽음 메시지/)).toBeNull());pane.rerender(<Probe org="b" allowed={false}/>);expect(screen.queryByLabelText(/미읽음 메시지/)).toBeNull();
});
