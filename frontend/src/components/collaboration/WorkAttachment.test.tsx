import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {WorkAttachment} from './WorkAttachment';
import {workJson} from '@/lib/team-collaboration';
vi.mock('@/lib/team-collaboration',()=>({workJson:vi.fn()}));
const props={file:{id:'f',name:'검수.png',mime:'image/png',size:1024},path:'/api/internal-chat/rooms/r/files',organizationId:'a',previewImage:true};
afterEach(()=>{cleanup();vi.mocked(workJson).mockReset();});
it('PRIVATE 썸네일을 우선하고 원본은 클릭 시 현재 권한으로 다시 요청한다',async()=>{
  vi.mocked(workJson).mockResolvedValue({thumbnailUrl:'https://files.example/thumb',previewUrl:'https://files.example/preview',originalUrl:'https://files.example/original'});
  const replace=vi.fn(),tab={opener:undefined,location:{replace},close:vi.fn()};const open=vi.spyOn(window,'open').mockReturnValue(tab as unknown as Window);
  render(<WorkAttachment {...props}/>);const image=await screen.findByRole('img');expect(image.getAttribute('src')).toBe('https://files.example/thumb');
  fireEvent.click(screen.getByRole('button',{name:'검수.png 원본 이미지 보기'}));await waitFor(()=>expect(replace).toHaveBeenCalledWith('https://files.example/original'));expect(workJson).toHaveBeenCalledTimes(2);open.mockRestore();
});
it('썸네일 조회 실패와 이미지 오류 뒤 재시도하고 일반 파일은 미리보기를 요청하지 않는다',async()=>{
  vi.mocked(workJson).mockRejectedValueOnce(new Error('권한 확인 실패')).mockResolvedValue({originalUrl:'https://files.example/f'});
  const pane=render(<WorkAttachment {...props}/>);await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'이미지 다시 불러오기'}));const image=await screen.findByRole('img');fireEvent.error(image);await screen.findByText('이미지를 불러오지 못했습니다.');
  pane.unmount();vi.mocked(workJson).mockClear();render(<WorkAttachment {...props} file={{...props.file,mime:'application/pdf',name:'검수.pdf'}}/>);expect(screen.queryByRole('img')).toBeNull();expect(workJson).not.toHaveBeenCalled();
});
