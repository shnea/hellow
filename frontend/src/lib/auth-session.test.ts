import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accessToken, clearAuthentication, SessionExpiredError, storeTokens } from './auth-session';
import { apiFetch } from './api';

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const config = () => Response.json({ issuer: 'https://identity.example.test', clientId: 'app' });
const renewed = () => Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'Bearer', expires_in: 300 });
const expired = () => storeTokens({ access_token: 'old-access', refresh_token: 'old-refresh', expires_in: 0 });

describe('session renewal', () => {
  it('renews once for simultaneous requests and retains the organization captured before renewal', async () => {
    expired(); sessionStorage.setItem('hellow_organization_id', 'first');
    const fetchMock = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith('oidc-config')) { await Promise.resolve(); sessionStorage.setItem('hellow_organization_id', 'second'); return config(); }
      if (url.endsWith('/token')) return renewed();
      expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer new-access');
      expect(new Headers(options?.headers).get('X-Organization-ID')).toBe('first');
      return Response.json({});
    });
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([apiFetch('/api/queue'), apiFetch('/api/customers')]);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/token'))).toHaveLength(1);
    expect(sessionStorage.getItem('hellow_refresh_token')).toBe('new-refresh');
  });

  it('keeps renewing through an hour without user interaction', async () => {
    vi.useFakeTimers();
    storeTokens({ access_token: 'old-access', refresh_token: 'old-refresh', expires_in: 300 });
    const mock = vi.fn(async (url: string) => url.endsWith('oidc-config') ? config() : renewed());
    vi.stubGlobal('fetch', mock);
    for (let minute = 0; minute < 61; minute++) {
      await vi.advanceTimersByTimeAsync(60_000);
      expect(await accessToken()).toBeTruthy();
    }
    expect(mock.mock.calls.filter(([url]) => url.endsWith('/token')).length).toBeGreaterThan(10);
  });

  it('retains drafts but clears expired authentication on invalid_grant', async () => {
    expired(); sessionStorage.setItem('draft', 'unsaved');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('oidc-config') ? config() : Response.json({ error: 'invalid_grant' }, { status: 400 })));
    await expect(accessToken()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(sessionStorage.getItem('hellow_access_token')).toBeNull();
    expect(sessionStorage.getItem('draft')).toBe('unsaved');
  });

  it('does not restore a session after logout during renewal', async () => {
    expired();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('oidc-config')) return config();
      clearAuthentication(); return renewed();
    }));
    await expect(accessToken()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(sessionStorage.getItem('hellow_access_token')).toBeNull();
  });

  it('preserves credentials on a temporary provider failure', async () => {
    expired();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('oidc-config') ? config() : new Response(null, { status: 503 })));
    await expect(accessToken()).rejects.toThrow('일시적으로');
    expect(sessionStorage.getItem('hellow_refresh_token')).toBe('old-refresh');
  });

  it('retries a rejected API request once and never retries a permission failure', async () => {
    storeTokens({ access_token: 'old-access', refresh_token: 'old-refresh', expires_in: 300 });
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('oidc-config')) return config();
      if (url.endsWith('/token')) return renewed();
      return new Response(null, { status: ++attempts === 1 ? 401 : 403 });
    }));
    expect((await apiFetch('/api/queue')).status).toBe(403);
    expect(attempts).toBe(2);
  });
});
