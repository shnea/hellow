'use client';
import { permissionLabels } from '@/lib/admin';
export function PermissionsField({value,onChange,disabled=false}:{value:string[];onChange:(value:string[])=>void;disabled?:boolean}) {
  return <fieldset disabled={disabled}><legend>허용할 기능</legend><div className="admin-permissions">
    {Object.entries(permissionLabels).map(([key,label])=><label key={key}><input type="checkbox" checked={value.includes(key)}
      onChange={e=>onChange(e.target.checked?[...value,key]:value.filter(v=>v!==key))}/>{label}</label>)}
  </div></fieldset>;
}
