import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ActiveWorkspace} from './ActiveWorkspace';
import {TemplateManagement} from './admin/TemplateManagement';
import {CatalogManagement} from './admin/CatalogManagement';
import {documentText} from '@/lib/editor-document';
import type {CatalogView,TextTemplate} from '@/lib/consultation-content';
import type {ConsultationDraft} from '@/lib/workspace-data';
vi.mock('./ShneaConsultationEditor',()=>({ShneaConsultationEditor:({initialText,onChangeText,readOnly}:{initialText:string;onChangeText:(t:string)=>void;readOnly:boolean})=><textarea aria-label="문서 본문" value={initialText} readOnly={readOnly} onChange={e=>onChangeText(e.target.value)}/>}));
const catalog:CatalogView={version:0,commonVersion:1,inherited:true,source:'COMMON',effective:{categories:[{id:'root',parentId:null,name:'제품',active:true},{id:'middle',parentId:'root',name:'설치',active:true},{id:'leaf',parentId:'middle',name:'Windows',active:true}],results:[{id:'done',name:'처리 완료',active:true}]}};
const template:TextTemplate={id:'common-1',overrideId:null,name:'설치 안내',body:'**설치 안내 원문**',active:true,version:0,commonVersion:3,scope:'ORGANIZATION',source:'COMMON',inherited:true};
const customer={customerType:'individual' as const,id:'customer',name:'고객',company:'',phoneNumber:'010',email:'',tier:'Standard' as const,isRegistered:true,lastContactDate:'',totalCalls:1,managerName:'직원',customerNotes:''};
const success=async()=>{};
const props={customer,queueCode:'queue-1',organizationId:'org-a',onDraftChange:()=>{},mediaStatus:'idle' as const,onMute:()=>undefined,callDuration:0,isCallActive:false,onEndCall:()=>{},onStartCall:()=>{},onOpenTransfer:()=>{},onRegisterCustomer:success,onUpdateCustomer:success};
let fetchMock:ReturnType<typeof vi.fn>;
beforeEach(()=>{sessionStorage.clear();sessionStorage.setItem('hellow_access_token','test-token');sessionStorage.setItem('hellow_organization_id','org-a');fetchMock=vi.fn(async(path:string)=>Response.json(path==='/api/consultation-catalog'?catalog:path==='/api/templates'?[template]:path.includes('consultation-catalog')?catalog:[template]));vi.stubGlobal('fetch',fetchMock);});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('saves a three-level stable classification and requires a result on completion',async()=>{
  const save=vi.fn<(d:ConsultationDraft&{isComplete:boolean})=>Promise<void>>(async()=>{});render(<ActiveWorkspace {...props} onSaveConsultation={save}/>);
  await screen.findByLabelText('상담 분류 1단계');fireEvent.change(screen.getByLabelText('상담 분류 2단계'),{target:{value:'middle'}});fireEvent.change(screen.getByLabelText('상담 분류 3단계'),{target:{value:'leaf'}});
  fireEvent.click(screen.getByRole('button',{name:'상담 기록 완료'}));await screen.findByText('상담 완료 전에 처리 결과를 선택해 주세요.');expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('상담 결과'),{target:{value:'done'}});fireEvent.click(screen.getByRole('button',{name:'상담 기록 완료'}));await waitFor(()=>expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0]).toMatchObject({categoryId:'leaf',categoryMain:'제품',categorySub:'Windows',categoryPath:['제품','설치','Windows'],resultId:'done',isComplete:true});
});
it('preserves saved labels for retired classifications and legacy completed records',async()=>{
  const save=vi.fn<(d:ConsultationDraft&{isComplete:boolean})=>Promise<void>>(async()=>{});const initial:ConsultationDraft={categoryId:null,categoryMain:'예전 대분류',categorySub:'예전 상세',status:'completed',selectedTags:[],memo:'과거 문서'};
  render(<ActiveWorkspace {...props} recordMode initialDraft={initial} onSaveConsultation={save}/>);await screen.findByLabelText('상담 분류 1단계');
  expect(screen.getByText(/기록 분류: 예전 대분류 › 예전 상세/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'임시 저장'}));await waitFor(()=>expect(save).toHaveBeenCalledOnce());expect(save.mock.calls[0][0]).toMatchObject({categoryId:null,categoryMain:'예전 대분류',categorySub:'예전 상세',resultId:null});
});
it('inserts an independent template document and retains it after a save conflict',async()=>{
  const save=vi.fn<(d:ConsultationDraft&{isComplete:boolean})=>Promise<void>>(async()=>{throw new Error('다른 창에서 변경됐습니다.');});render(<ActiveWorkspace {...props} onSaveConsultation={save}/>);await screen.findByRole('option',{name:'설치 안내'});
  fireEvent.click(screen.getByText('태그·템플릿 추가'));fireEvent.change(screen.getByLabelText('삽입할 템플릿'),{target:{value:'common-1'}});fireEvent.click(screen.getByRole('button',{name:'본문에 삽입'}));
  fireEvent.click(screen.getByRole('button',{name:'임시 저장'}));await screen.findByText('다른 창에서 변경됐습니다.');expect(documentText((screen.getByLabelText('문서 본문') as HTMLTextAreaElement).value)).toContain('설치 안내 원문');
  const submitted=save.mock.calls[0][0];expect(submitted.memo).toContain('bold');expect(submitted.memo).not.toContain('common-1');
});
it('refreshes configuration on return from settings without replacing unsaved document content',async()=>{
  const save=vi.fn<(d:ConsultationDraft&{isComplete:boolean})=>Promise<void>>(async()=>{});
  const view=render(<ActiveWorkspace {...props} contentRefresh={0} onSaveConsultation={save}/>);await screen.findByRole('option',{name:'설치 안내'});
  fireEvent.change(screen.getByLabelText('문서 본문'),{target:{value:'내 미저장 문서'}});
  fetchMock.mockImplementation(async(path:string)=>Response.json(path==='/api/consultation-catalog'?catalog:[{...template,name:'변경된 템플릿'}]));
  view.rerender(<ActiveWorkspace {...props} contentRefresh={1} onSaveConsultation={save}/>);await screen.findByRole('option',{name:'변경된 템플릿'});
  expect((screen.getByLabelText('문서 본문') as HTMLTextAreaElement).value).toBe('내 미저장 문서');
});
it('creates an organization override and restores with both version checks',async()=>{
  fetchMock.mockImplementation(async(_path:string,o?:RequestInit)=>Response.json(o?.method?[{...template,overrideId:'override-1',version:1,inherited:false,source:'ORGANIZATION',body:'조직'}]:[template]));
  render(<TemplateManagement scope="organization" organizationId="org-a"/>);await screen.findByRole('button',{name:'설치 안내 템플릿 편집'});fireEvent.click(screen.getByRole('button',{name:'설치 안내 템플릿 편집'}));fireEvent.change(screen.getByLabelText('템플릿 본문'),{target:{value:'조직 내용'}});fireEvent.click(screen.getByRole('button',{name:'조직 템플릿으로 저장'}));
  await screen.findByRole('button',{name:'공통 템플릿으로 복원'});const create=fetchMock.mock.calls.find(([,o])=>o?.method==='POST');expect(create?.[0]).toBe('/api/admin/templates/organization');expect(JSON.parse(create?.[1].body)).toMatchObject({originId:'common-1',expectedVersion:0,expectedCommonVersion:3,body:'조직 내용'});
  fireEvent.click(screen.getByRole('button',{name:'공통 템플릿으로 복원'}));await waitFor(()=>expect(fetchMock.mock.calls.some(([p])=>p==='/api/admin/templates/organization/override-1/restore')).toBe(true));
  const restore=fetchMock.mock.calls.find(([p])=>p.endsWith('/restore'));expect(JSON.parse(restore?.[1].body)).toEqual({expectedVersion:1,expectedCommonVersion:3});
});
it('retains personal template input on conflicts and only uses the personal endpoint',async()=>{
  const personal={...template,id:'mine',version:2,scope:'PERSONAL',source:'PERSONAL',inherited:false};fetchMock.mockImplementation(async(_p:string,o?:RequestInit)=>o?.method?Response.json({detail:'버전 충돌'},{status:409}):Response.json([personal]));
  render(<TemplateManagement scope="personal" organizationId="org-a"/>);await screen.findByRole('button',{name:'설치 안내 템플릿 편집'});fireEvent.click(screen.getByRole('button',{name:'설치 안내 템플릿 편집'}));fireEvent.change(screen.getByLabelText('템플릿 본문'),{target:{value:'내 미저장 내용'}});fireEvent.click(screen.getByRole('button',{name:'템플릿 저장'}));await screen.findByRole('alert');
  expect((screen.getByLabelText('템플릿 본문') as HTMLTextAreaElement).value).toBe('내 미저장 내용');expect(fetchMock.mock.calls.every(([p])=>p.startsWith('/api/templates/personal'))).toBe(true);expect(JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body)).toMatchObject({expectedVersion:2,originId:null});
});
it('keeps edited catalog input when server rejects a stale version',async()=>{
  fetchMock.mockImplementation(async(_p:string,o?:RequestInit)=>o?.method?Response.json({detail:'공통 목록 변경'},{status:409}):Response.json(catalog));
  render(<CatalogManagement scope="organization" organizationId="org-a"/>);await screen.findByRole('button',{name:'제품 분류 편집'});fireEvent.click(screen.getByRole('button',{name:'제품 분류 편집'}));fireEvent.change(screen.getByLabelText('분류 이름'),{target:{value:'조직 제품'}});fireEvent.click(screen.getByRole('button',{name:'분류를 목록에 반영'}));fireEvent.click(screen.getByRole('button',{name:'조직 분류·결과 저장'}));await screen.findByRole('alert');
  expect(screen.getByText('조직 제품 · 활성')).toBeTruthy();const write=fetchMock.mock.calls.find(([,o])=>o?.method==='PUT');expect(JSON.parse(write?.[1].body)).toMatchObject({expectedVersion:0,expectedCommonVersion:1,inherit:false});
});
