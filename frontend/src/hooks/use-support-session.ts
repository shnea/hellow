'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {loadSupportRequest, prepareSupportMicrophone, storeSupportRequest, supportJson, SupportHttpError,
  clearSupportResume, loadSupportResume,
  supportStorageKey, validateSupportSession, type SupportRequest, type SupportSession} from '@/lib/support-session';

export type SupportStep = 'RESTORING' | 'FORM' | 'PENDING' | 'WAITING' | 'PROCESSING' | 'FINISHED' | 'CANCELLED' | 'EXPIRED' | 'UNAVAILABLE' | 'CALLBACK_REQUESTED';
const stepFor = (session: SupportSession): SupportStep => session.status === 'COMPLETED' || session.status === 'CALL_ENDED' || Boolean(session.chatEndedAt)
  ? 'FINISHED' : session.status === 'CANCELLED' ? 'CANCELLED' : session.status;

export function useSupportSession(code: string) {
  const [step, setStep] = useState<SupportStep>('RESTORING');
  const [request, setRequest] = useState<SupportRequest | null>(null);
  const [session, setSession] = useState<SupportSession | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<SupportRequest | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const pollAbort = useRef<AbortController | null>(null);
  const sessionId = session?.sessionId;
  const invalidate = useCallback(() => {++generation.current;}, []);

  const apply = useCallback((data: SupportSession) => {
    validateSupportSession(data);
    setSession(data); setStep(stepFor(data)); setError('');
  }, []);

  const failure = useCallback((e: unknown) => {
    const problem = e as Error;
    setError(problem.message || '네트워크에 연결하지 못했습니다. 기존 요청을 다시 확인해 주세요.');
    if (e instanceof SupportHttpError && e.status === 410) setStep('EXPIRED');
    else if (e instanceof SupportHttpError && e.status === 404) setStep('UNAVAILABLE');
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    const abort = new AbortController();
    pending.current = null; inFlight.current = false;
    void (async () => {
      try {
        setSession(null); setRequest(null); setError(''); setBusy(false); setStep('RESTORING');
        if (!code) return;
        const saved = loadSupportRequest(code);
        if (abort.signal.aborted) return;
        pending.current = saved; setRequest(saved);
        const resume = loadSupportResume(code);
        if (!saved && resume) {
          const restored = await supportJson<SupportSession>(`/api/support/session/${encodeURIComponent(resume)}`, {signal:abort.signal});
          if (!abort.signal.aborted && generation.current === current) apply(restored);
          return;
        }
        if (!saved) {setStep('FORM'); return;}
        const data = await supportJson<SupportSession>(`/api/support/request/${encodeURIComponent(code)}/${saved.requestId}`, {signal:abort.signal});
        if (!abort.signal.aborted && generation.current === current) apply(data);
      } catch (e) {
        if (abort.signal.aborted || generation.current !== current) return;
        if (e instanceof SupportHttpError && e.status === 404) {
          setStep('PENDING'); setError('이전 접수 결과를 확인하지 못했습니다. 보관된 동일 요청으로 다시 시도해 주세요.');
        } else if (pending.current) {setStep('PENDING'); failure(e);}
        else {setStep('UNAVAILABLE'); failure(e);}
      }
    })();
    return () => {abort.abort(); invalidate();};
  }, [code, apply, failure, invalidate]);

  useEffect(() => {
    if (!sessionId || busy || (step !== 'WAITING' && step !== 'PROCESSING')) return;
    const abort = new AbortController(); pollAbort.current = abort;
    const current = generation.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await supportJson<SupportSession>(`/api/support/session/${sessionId}`, {signal:abort.signal});
        if (!abort.signal.aborted && current === generation.current) apply(data);
      } catch (e) {if (!abort.signal.aborted && current === generation.current) failure(e);}
      finally {if (!abort.signal.aborted && current === generation.current) timer = setTimeout(poll, 2000);}
    };
    void poll();
    return () => {abort.abort(); clearTimeout(timer); if (pollAbort.current === abort) pollAbort.current = null;};
  }, [sessionId, step, busy, apply, failure]);

  const submit = async (input?: Omit<SupportRequest, 'requestId' | 'organizationCode'>) => {
    if (!code || inFlight.current || (step !== 'FORM' && step !== 'PENDING')) return;
    inFlight.current = true; setBusy(true); setError(''); pollAbort.current?.abort();
    const current = ++generation.current;
    try {
      let payload = pending.current;
      if (payload) {
        try {
          const found = await supportJson<SupportSession>(`/api/support/request/${encodeURIComponent(code)}/${payload.requestId}`);
          if (current === generation.current) apply(found);
          return;
        } catch (e) {if (!(e instanceof SupportHttpError) || e.status !== 404) throw e;}
      } else {
        if (!input) return;
        if (!input.customerName.trim() || !input.phoneNumber.trim() || !input.message.trim()) throw new Error('성함·연락처·문의 내용을 입력해 주세요.');
      }
      if ((payload?.channel || input?.channel) === 'CALL') await prepareSupportMicrophone();
      if (current !== generation.current) return;
      if (!payload) {
        payload = {...input!, organizationCode:code, requestId:crypto.randomUUID()};
        try {storeSupportRequest(payload);}
        catch {throw new Error('접수 복원 정보를 보관하지 못했습니다. 브라우저 저장소 사용 설정을 확인해 주세요. 요청은 전송하지 않았습니다.');}
        pending.current = payload; setRequest(payload); setStep('PENDING');
      }
      const data = await supportJson<SupportSession>('/api/support/request', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
      if (current === generation.current) apply(data);
    } catch (e) {if (current === generation.current) failure(e);}
    finally {if (current === generation.current) {inFlight.current = false; setBusy(false);}}
  };

  const changeSession = async (action: 'cancel' | 'end-call') => {
    if (!session || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); pollAbort.current?.abort();
    const current = ++generation.current;
    try {
      const data = await supportJson<SupportSession>(`/api/support/session/${session.sessionId}/${action}`, {method:'POST'});
      if (current === generation.current) apply(data);
    } catch (e) {
      if (current !== generation.current) return;
      if (e instanceof SupportHttpError && e.status === 409) {
        try {
          const data = await supportJson<SupportSession>(`/api/support/session/${session.sessionId}`);
          if (current === generation.current) apply(data);
        } catch (lookup) {if (current === generation.current) failure(lookup); return;}
      }
      if (current === generation.current) failure(e);
    } finally {if (current === generation.current) {inFlight.current = false; setBusy(false);}}
  };

  const newRequest = () => {
    if (inFlight.current || !['FINISHED','CANCELLED','EXPIRED'].includes(step)) return;
    try {sessionStorage.removeItem(supportStorageKey(code)); clearSupportResume(code);}
    catch {setError('이전 접수 정보를 정리하지 못했습니다. 브라우저 저장소 사용 설정을 확인해 주세요.'); return;}
    ++generation.current; pollAbort.current?.abort(); pending.current = null;
    setRequest(null); setSession(null); setError(''); setStep('FORM');
  };

  return {step, request, session, busy, error, submit, cancel:() => changeSession('cancel'), endCall:() => changeSession('end-call'), newRequest};
}
