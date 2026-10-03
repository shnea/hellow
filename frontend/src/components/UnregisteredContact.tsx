'use client';
import {useState} from 'react';
import type {CustomerProfile} from '@/types';
export function UnregisteredContact({customer,disabled,onSave,onRegister}:{customer:CustomerProfile;disabled:boolean;onSave:(data:Partial<CustomerProfile>)=>Promise<void>;onRegister?:()=>void}){
  const [editing,setEditing]=useState(false);const [name,setName]=useState(customer.name);const [phone,setPhone]=useState(customer.phoneNumber);const [company,setCompany]=useState(customer.company||'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  return <section className="unregistered-contact" aria-label="미등록 고객 정보">
    {editing?<form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{await onSave({name:name.trim(),phoneNumber:phone.trim(),company:company.trim()});setEditing(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
      <label>고객명<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>연락처<input required type="tel" maxLength={30} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
      <label>회사<input maxLength={200} value={company} onChange={e=>setCompany(e.target.value)}/></label>
      <button disabled={disabled||busy} type="submit">고객 정보 저장</button><button disabled={busy} type="button" onClick={()=>{setEditing(false);setError('');}}>취소</button>
    </form>:<><div><strong>{customer.name||'이름 미입력'}</strong><span>{customer.phoneNumber}</span>{customer.company&&<span>{customer.company}</span>}<span className="text-slate-400">미등록</span></div>
      <button disabled={disabled} onClick={()=>{setName(customer.name);setPhone(customer.phoneNumber);setCompany(customer.company||'');setEditing(true);}}>정보 수정</button>
      {onRegister&&<button disabled={disabled} onClick={onRegister}>고객 등록</button>}</>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
