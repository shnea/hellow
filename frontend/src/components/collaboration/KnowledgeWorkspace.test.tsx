import {render,screen,fireEvent,waitFor,cleanup,within} from '@testing-library/react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {KnowledgeWorkspace} from './KnowledgeWorkspace';
import {workJson} from '@/lib/team-collaboration';
import {ApiError} from '@/lib/api';
vi.mock('@/lib/team-collaboration',async()=>({...await vi.importActual('@/lib/team-collaboration'),workJson:vi.fn(),workUpload:vi.fn()}));
vi.mock('../ShneaConsultationEditor',()=>({ShneaConsultationEditor:({initialText,onChangeText,readOnly}:{initialText:string;onChangeText?:(text:string)=>void;readOnly:boolean})=><textarea aria-label="지식 본문" value={initialText} readOnly={readOnly} onChange={e=>onChangeText?.(e.target.value)}/>}));
const fixture={id:'doc',version:2,title:'게시 지식',category:'기술',kind:'DOCUMENT',visibility:'ORGANIZATION',state:'PUBLISHED',revision:1,publishedRevision:1,unpublishedChanges:false,document:'{"format":"shnea-editor","content":{"type":"doc"}}',attachments:[],authorName:'직원',updatedAt:'2026-10-04T00:00:00Z',editable:true,publishable:true};
const props={active:true,organizationId:'a',storageKey:'knowledge-test',canRead:true,canWrite:true,canPublish:true};
const api=vi.mocked(workJson);
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};sessionStorage.clear();window.history.replaceState(null,'','/');api.mockReset();api.mockImplementation(async(path)=>path.startsWith('/api/knowledge?')?{items:[fixture],hasMore:false}:fixture);});
afterEach(cleanup);
it('목록 조건과 초안을 유지하며 팝업으로 열고 닫기·Escape로 목록에 돌아온다',async()=>{
 render(<KnowledgeWorkspace {...props}/>);await screen.findByText('게시 지식');fireEvent.change(screen.getByLabelText('제목·분류·본문'),{target:{value:'기술'}});fireEvent.click(screen.getByRole('button',{name:'게시 지식 열기'}));const dialog=await screen.findByRole('dialog',{name:'지식 상세보기'});fireEvent.change(await within(dialog).findByLabelText('제목'),{target:{value:'팝업 초안'}});
 expect(screen.getByLabelText('제목·분류·본문').getAttribute('value')).toBe('기술');expect(document.querySelector('.list-table tbody tr')).not.toBeNull();fireEvent.click(within(dialog).getByRole('button',{name:'닫기'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(new URL(window.location.href).searchParams.has('knowledge')).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'게시 지식 열기'}));const reopened=await screen.findByRole('dialog');expect((await within(reopened).findByLabelText('제목') as HTMLInputElement).value).toBe('팝업 초안');fireEvent(reopened,new Event('cancel',{bubbles:true,cancelable:true}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
});
it('비활성 메뉴는 조회하지 않고 활성 메뉴에서 조직별 목록·검색을 조회한다',async()=>{
 const {rerender}=render(<KnowledgeWorkspace {...props} active={false}/>);expect(api).not.toHaveBeenCalled();rerender(<KnowledgeWorkspace {...props}/>);await screen.findByText('게시 지식');fireEvent.change(screen.getByLabelText('제목·분류·본문'),{target:{value:'찾을 본문'}});fireEvent.click(screen.getByRole('button',{name:'검색'}));await waitFor(()=>expect(api.mock.calls.some(([path,org])=>path.includes('q=%EC%B0%BE%EC%9D%84')&&org==='a')).toBe(true));
});
it('다른 메뉴 왕복 뒤 초안을 보존하고 저장 전 게시를 차단한다',async()=>{
 const {rerender}=render(<KnowledgeWorkspace {...props}/>);await screen.findByText('게시 지식');fireEvent.click(screen.getByRole('button',{name:'게시 지식 열기'}));const title=await screen.findByLabelText('제목');fireEvent.change(title,{target:{value:'보관된 입력'}});expect((screen.getByRole('button',{name:'게시'}) as HTMLButtonElement).disabled).toBe(true);
 rerender(<KnowledgeWorkspace {...props} active={false}/>);rerender(<KnowledgeWorkspace {...props}/>);await waitFor(()=>expect((screen.getByLabelText('제목') as HTMLInputElement).value).toBe('보관된 입력'));expect(sessionStorage.getItem(props.storageKey)).toContain('보관된 입력');
});
it('저장 충돌 뒤 입력을 유지하고 최신 버전 확인 동작을 요구한다',async()=>{
 render(<KnowledgeWorkspace {...props}/>);await screen.findByText('게시 지식');fireEvent.click(screen.getByRole('button',{name:'게시 지식 열기'}));fireEvent.change(await screen.findByLabelText('제목'),{target:{value:'내 수정'}});
 api.mockImplementation(async(path,_org,options)=>{if(options?.method==='PUT')throw new ApiError(409,'버전 충돌');return path.startsWith('/api/knowledge?')?{items:[fixture],hasMore:false}:{...fixture,version:3,title:'서버 최신'};});
 fireEvent.click(screen.getByRole('button',{name:'초안 저장'}));await screen.findByRole('button',{name:'확인한 최신 버전에 내 초안 적용'});expect((screen.getByLabelText('제목') as HTMLInputElement).value).toBe('내 수정');expect((screen.getByRole('button',{name:'초안 저장'}) as HTMLButtonElement).disabled).toBe(true);
});
it('읽기 전용 게시본에는 작성·게시·버전 이력 동작이 없다',async()=>{
 api.mockImplementation(async(path)=>path.startsWith('/api/knowledge?')?{items:[{...fixture,editable:false,publishable:false}],hasMore:false}:{...fixture,editable:false,publishable:false});render(<KnowledgeWorkspace {...props} canWrite={false} canPublish={false}/>);await screen.findByText('게시 지식');expect(screen.queryByRole('button',{name:'지식 작성'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'게시 지식 열기'}));await screen.findByRole('heading',{name:'게시 지식'});expect(screen.queryByRole('button',{name:'게시'})).toBeNull();expect(screen.queryByRole('button',{name:'버전 이력'})).toBeNull();
});
