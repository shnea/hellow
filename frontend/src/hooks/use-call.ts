'use client';
import { useEffect, useRef, useState } from 'react';
import { apiJson } from '@/lib/api';
import { LiveKitCallSession } from '@/lib/livekit';

export function useCall(queueCode: string | null) {
  const session = useRef<LiveKitCallSession | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    // Synchronize the independent media session lifecycle when its queue changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDuration(0);
    if (!queueCode) { setStatus('idle'); return; }
    let active = true;
    const call = new LiveKitCallSession({ onConnected: () => active && setStatus('connected'),
      onDisconnected: () => active && setStatus('idle'), onError: () => active && setStatus('error') });
    session.current = call;
    setStatus('connecting');
    const abort = new AbortController();
    apiJson<{ url: string; token: string }>(`/api/queue/${queueCode}/token`, { method: 'POST', signal: abort.signal })
      .then(data => active ? call.connect(data.url, data.token) : undefined)
      .catch(() => active && setStatus('error'));
    return () => { active = false; abort.abort(); void call.disconnect(); session.current = null; };
  }, [queueCode]);
  useEffect(() => {
    if (status !== 'connected') return;
    const timer = setInterval(() => setDuration(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);
  return { status, duration, setMuted: (muted: boolean) => session.current?.setMuted(muted) };
}
