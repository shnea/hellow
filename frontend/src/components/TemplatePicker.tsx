'use client';
import {templateSource,type TextTemplate} from '@/lib/consultation-content';
export function TemplatePicker({templates,disabled,onInsert}:{templates:TextTemplate[];disabled:boolean;onInsert:(text:string)=>void}){
  const active=templates.filter(t=>t.active);
  return <div className="template-chips" aria-label="자주 사용하는 템플릿"><span>자주 사용하는 템플릿 :</span>
    <div className="template-chip-list">{active.map(t=><button key={t.id} type="button" disabled={disabled}
      title={`${templateSource[t.source]||''} · ${t.body}`} onClick={()=>onInsert(t.body)}>{t.name}</button>)}
      {!active.length&&<span>등록된 템플릿 없음</span>}</div>
  </div>;
}
