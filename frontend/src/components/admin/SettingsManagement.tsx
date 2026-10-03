'use client';
import { useState } from 'react';
import { adminJson, type SettingsView } from '@/lib/admin';
import { jsonBody } from '@/lib/api';
const fields=[{key:'title',label:'접수 화면 제목',max:150},{key:'description',label:'안내 문구',max:500},
  {key:'buttonLabel',label:'요청 버튼 문구',max:100},{key:'primaryColor',label:'주요 색상',max:7},{key:'logoUrl',label:'로고 HTTPS 이미지 주소',max:1000}];
export function SettingsManagement({scope,organizationId,initial,onSaved}:{scope:'common'|'organization';organizationId:string;initial:SettingsView;onSaved:(view:SettingsView)=>void}) {
  const [values,setValues]=useState({...initial.overrides});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);
  const save=async()=>{if(busy)return;setBusy(true);setError('');setSaved(false);
    try{const view=await adminJson<SettingsView>(`/api/admin/settings/${scope}`,organizationId,jsonBody({expectedVersion:initial.version,...Object.fromEntries(fields.map(f=>[f.key,values[f.key]??null]))},'PUT'));onSaved(view);setSaved(true);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <section className="admin-section"><h2>{scope==='common'?'공통 고객 접수 설정':'조직 고객 접수 설정'}</h2>
    <p>{scope==='common'?'공통값을 변경하면 해당 항목을 상속하는 조직에 적용됩니다.':'별도로 지정하지 않은 항목은 공통 설정을 따릅니다. 공통 설정이 변경되어도 조직이 지정한 값은 유지됩니다.'}</p>
    <form className="admin-form" onSubmit={e=>{e.preventDefault();void save();}}>
      {fields.map(field=><div className="admin-setting-row" key={field.key}><label>{field.label}
        <input value={values[field.key]??initial.effective[field.key]??''} maxLength={field.max} disabled={busy||!(field.key in values)}
          placeholder={field.key==='primaryColor'?'#4f46e5':undefined} onChange={e=>setValues(v=>({...v,[field.key]:e.target.value}))}/></label>
        <label className="admin-check"><input type="checkbox" disabled={busy} checked={field.key in values} onChange={e=>setValues(v=>{const copy={...v};if(e.target.checked)copy[field.key]=initial.effective[field.key]||'';else delete copy[field.key];return copy;})}/>{scope==='common'?'공통값 지정':'조직 값 지정'}</label>
        <small>{field.key in values?(scope==='common'?'공통 설정':'조직 설정'):(scope==='common'?'제품 기본값 사용':'공통 설정 상속')}</small>
      </div>)}
      <div className="admin-actions"><button className="admin-primary" disabled={busy}>{busy?'저장 중…':'설정 저장'}</button><button type="button" disabled={busy} onClick={()=>setValues({})}>{scope==='common'?'제품 기본값 복원':'모든 항목 공통값으로 복원'}</button></div>
      {error&&<p role="alert" className="admin-error">{error} 입력은 유지됩니다.</p>}{saved&&<p role="status" className="admin-success">설정을 저장했습니다.</p>}
    </form><h3>현재 적용 값</h3><dl className="admin-effective">{fields.map(f=><div key={f.key}><dt>{f.label}</dt><dd>{initial.effective[f.key]||'미지정'}</dd></div>)}</dl>
  </section>;
}
