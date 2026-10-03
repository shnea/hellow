import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthCallbackPage from './page';

const { replace, exchange, verify } = vi.hoisted(() => ({
  replace: vi.fn(), exchange: vi.fn(), verify: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('code=fixture-code&state=fixture-state'),
}));
vi.mock('@/lib/pkce', () => ({ exchangeCodeForToken: exchange }));
vi.mock('jose', () => ({ jwtVerify: verify, createRemoteJWKSet: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  sessionStorage.setItem('oidc_state', 'fixture-state');
  sessionStorage.setItem('oidc_verifier', 'fixture-verifier');
  sessionStorage.setItem('oidc_nonce', 'fixture-nonce');
  replace.mockReset();
  exchange.mockResolvedValue({ access_token: 'synthetic-access', id_token: 'synthetic-id' });
  verify.mockResolvedValue({ payload: { nonce: 'fixture-nonce', email: 'agent@example.test' } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function mockResponses(auditStatus: number) {
  const fetchMock = vi.fn<(path: string, options?: RequestInit) => Promise<Response>>(async (path) => {
    if (path === '/api/platform/oidc-config') return Response.json({ issuer: 'https://identity.example.test/realm', clientId: 'app' });
    if (path === '/api/me') return Response.json({ name: '검수 상담사' });
    if (path === '/api/session/login') return new Response(null, { status: auditStatus });
    throw new Error('예상하지 않은 요청');
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('OIDC callback and login audit response', () => {
  it.each([200, 204])('retains the authenticated session and enters the workspace after an empty %s audit response', async (status) => {
    const fetchMock = mockResponses(status);
    render(<AuthCallbackPage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('로그인 성공!')).toBeTruthy();
    expect(sessionStorage.getItem('hellow_access_token')).toBe('synthetic-access');
    const auditOptions = fetchMock.mock.calls.find(([path]) => path === '/api/session/login')?.[1] as RequestInit | undefined;
    expect(new Headers(auditOptions?.headers).get('Authorization')).toBe('Bearer synthetic-access');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('still rejects an unauthorized audit response and removes the incomplete session', async () => {
    mockResponses(401);
    render(<AuthCallbackPage />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText('인증 실패')).toBeTruthy();
    expect(screen.getByText('로그인이 만료되었습니다. 다시 로그인해 주세요.')).toBeTruthy();
    expect(sessionStorage.getItem('hellow_access_token')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });
});
