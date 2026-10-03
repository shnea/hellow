'use client';
import {useState} from 'react';
import {templateSource,type TextTemplate} from '@/lib/consultation-content';
export function TemplatePicker({templates,disabled,onInsert}:{templates:TextTemplate[];disabled:boolean;onInsert:(text:string)=>void}){
  const [selected,setSelected]=useState('');const current=templates.find(t=>t.id===selected&&t.active);
  return <div className="template-picker"><label>삽입할 템플릿<select aria-label="삽입할 템플릿" value={current?.id||''} disabled={disabled} onChange={e=>setSelected(e.target.value)}>
    <option value="">{templates.length?'템플릿 선택':'등록된 템플릿 없음'}</option>
    {['COMMON','ORGANIZATION','PERSONAL'].map(scope=><optgroup key={scope} label={templateSource[scope]}>{templates.filter(t=>t.source===scope&&t.active).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>)}
  </select></label><button type="button" disabled={disabled||!current} onClick={()=>{if(current)onInsert(current.body);}}>본문에 삽입</button>
    {current&&<details><summary>템플릿 내용 미리보기</summary><p className="whitespace-pre-wrap">{current.body}</p></details>}
  </div>;
}
