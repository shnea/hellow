'use client';
import { useEffect, useRef, useState } from 'react';
import { apiJson } from '@/lib/api';
import { LiveKitCallSession } from '@/lib/livekit';

export function useCall(queueCode: string | null) {
  const session = useRef<LiveKitCallSession | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    // Synchronize the independent media session lifecycle when its queue changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDuration(0);
    setError('');
    if (!queueCode) { setStatus('idle'); return; }
    let active = true;
    const call = new LiveKitCallSession({ onConnected: () => active && setStatus('connected'),
      onDisconnected: () => active && setStatus('idle'), onError: err => {if(active){setError(err.message);setStatus('error');}} });
    session.current = call;
    setStatus('connecting');
    const abort = new AbortController();
    let release: (() => void) | undefined;
    const connect = async () => {
      if (!active) return;
      const data = await apiJson<{ url: string; token: string }>(`/api/queue/${queueCode}/token`, { method: 'POST', signal: abort.signal });
      if (active) await call.connect(data.url, data.token);
    };
    // Hold one origin-wide lock for the full media lifecycle, including token acquisition.
    const start = navigator.locks
      ? navigator.locks.request('hellow-agent-audio', { ifAvailable: true }, async lock => {
          if (!active) return;
          if (!lock) throw new Error('다른 창에서 통화가 연결돼 있습니다. 그 창에서 통화를 진행해 주세요.');
          try { await connect(); await new Promise<void>(resolve => { release = resolve; if (!active) resolve(); }); }
          finally { call.disconnect(); }
        })
      : Promise.reject(new Error('통화 중복 연결 방지를 지원하는 최신 브라우저를 사용해 주세요.'));
    void start.catch(err => { if(active) { setError((err as Error).message); setStatus('error'); } });
    return () => { active = false; abort.abort(); release?.(); call.disconnect(); session.current = null; };
  }, [queueCode]);
  useEffect(() => {
    if (status !== 'connected') return;
    const timer = setInterval(() => setDuration(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);
  return { status, duration, error, setMuted: (muted: boolean) => session.current?.setMuted(muted) };
}
