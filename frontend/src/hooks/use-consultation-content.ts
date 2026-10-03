'use client';
import {useEffect,useState} from 'react';
import {apiJson} from '@/lib/api';
import type {CatalogView,TextTemplate} from '@/lib/consultation-content';
export function useConsultationContent(organizationId:string,refreshKey=0){
  const [catalog,setCatalog]=useState<CatalogView|null>(null);const [templates,setTemplates]=useState<TextTemplate[]>([]);
  const [error,setError]=useState('');const [refresh,setRefresh]=useState(0);const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const abort=new AbortController();
    // This editor is keyed by organization; refresh keeps the current draft intact.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([apiJson<CatalogView>('/api/consultation-catalog',{signal:abort.signal}),apiJson<TextTemplate[]>('/api/templates',{signal:abort.signal})])
      .then(([c,t])=>{if(!abort.signal.aborted){setCatalog(c);setTemplates(t);setError('');}})
      .catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return()=>abort.abort();
  },[organizationId,refresh,refreshKey]);
  return {catalog,templates,error,loading,reload:()=>setRefresh(v=>v+1)};
}
