'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, apiJson, jsonBody } from '@/lib/api';
import '@/components/admin/admin.css';
export default function InvitationPage() {
  const router=useRouter();
  const [token,setToken]=useState('');const [name,setName]=useState('');const [loginRequired,setLoginRequired]=useState(false);
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [joined,setJoined]=useState('');
  useEffect(()=>{const abort=new AbortController();const value=new URLSearchParams(window.location.search).get('token')||'';
    // The invitation belongs to this URL; keep it while the user completes sign-in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(value);
    if(!value){setError('초대 링크가 없습니다. 관리자에게 받은 링크로 접속해 주세요.');setLoading(false);return;}
    apiJson<{name:string}>('/api/me',{signal:abort.signal}).then(me=>{if(!abort.signal.aborted)setName(me.name);})
      .catch(e=>{if(!abort.signal.aborted){if(e instanceof ApiError&&e.status===401)setLoginRequired(true);else setError(e.message);}})
      .finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();
  },[]);
  const login=()=>{sessionStorage.setItem('auth_redirect_to',window.location.pathname+window.location.search);router.push('/login');};
  const accept=async()=>{if(busy)return;setBusy(true);setError('');
    try{const org=await apiJson<{organizationId:string;name:string}>('/api/invitations/accept',jsonBody({token}));
      sessionStorage.setItem('hellow_organization_id',org.organizationId);setJoined(org.name);
      window.history.replaceState(null,'','/invite');setToken('');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  return <main className="admin-shell"><section className="admin-section"><h1>조직 초대</h1>
    {loading?<p role="status">로그인을 확인하고 있습니다.</p>:joined?<><p role="status">{joined}에 가입했습니다.</p><Link href="/">상담 화면으로 이동</Link></>:<>
      {error&&<p role="alert" className="admin-error">{error}</p>}
      {loginRequired?<><p>초대받은 이메일이 인증된 플랫폼 계정으로 로그인해 주세요.</p><button className="admin-primary" onClick={login}>로그인 후 초대 확인</button></>:
        token&&<><p>{name} 계정으로 초대를 수락합니다. 조직 가입 권한은 초대에 지정된 기능으로 적용됩니다.</p>
          <button className="admin-primary" disabled={busy} onClick={()=>void accept()}>{busy?'수락 중…':'조직 초대 수락'}</button></>}
    </>}
  </section></main>;
}
