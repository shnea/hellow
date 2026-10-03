'use client';
import {categoryChain,classify,type Classification,type Catalog} from '@/lib/consultation-content';
export function ConsultationClassification({catalog,value,resultId,resultName,disabled,onCategory,onResult}:{
  catalog:Catalog|null;value:Classification;resultId:string|null;resultName:string;disabled:boolean;
  onCategory:(value:Classification)=>void;onResult:(id:string|null,name:string)=>void;
}){
  const chain=categoryChain(catalog?.categories||[],value.categoryId);
  const savedLabel=(value.categoryPath?.length?value.categoryPath:[value.categoryMain,value.categorySub].filter(Boolean)).join(' › ');
  return <div className="consultation-classification">
    {catalog&&[0,1,2].map(level=>{
      const parent=level===0?null:chain[level-1]?.id;if(level>0&&!parent)return null;
      const choices=catalog.categories.filter(n=>n.parentId===parent&&(n.active||chain[level]?.id===n.id));
      if(level>0&&!choices.length)return null;
      return <label key={level}>상담 분류 {level+1}단계<select aria-label={`상담 분류 ${level+1}단계`} disabled={disabled} value={chain[level]?.id||''}
        onChange={e=>{const id=e.target.value||parent;if(id)onCategory(classify(catalog.categories,id));}}>
        <option value="">{level===0?'분류 선택':'현재 단계까지 사용'}</option>
        {choices.map(n=><option key={n.id} value={n.id}>{n.name}{!n.active?' (기존 · 비활성)':''}</option>)}
      </select></label>;
    })}
    <label>상담 결과<select aria-label="상담 결과" value={resultId||''} disabled={disabled||!catalog} onChange={e=>onResult(e.target.value||null,catalog?.results.find(r=>r.id===e.target.value)?.name||'')}>
      <option value="">완료 전에 선택</option>
      {catalog?.results.filter(r=>r.active||r.id===resultId).map(r=><option key={r.id} value={r.id}>{r.id===resultId&&resultName?resultName:r.name}{!r.active?' (기존 · 비활성)':''}</option>)}
      {resultId&&!catalog?.results.some(r=>r.id===resultId)&&<option value={resultId}>{resultName||'기존 결과'}</option>}
    </select></label>
    {savedLabel&&<p className="classification-snapshot">기록 분류: {savedLabel}{value.categoryId===null?' · 기존 기록':''}</p>}
  </div>;
}
