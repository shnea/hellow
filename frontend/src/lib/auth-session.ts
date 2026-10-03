/** Token renewal is shared by all requests in this tab, including polling. */
export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
}

export class SessionExpiredError extends Error {
  constructor() { super('로그인이 만료되었습니다. 다시 로그인해 주세요.'); }
}

let renewal: Promise<string | null> | null = null;

export function clearAuthentication() {
  for (const key of ['access_token', 'refresh_token', 'id_token', 'token_expires_at']) {
    sessionStorage.removeItem(`hellow_${key}`);
  }
}

export function storeTokens(tokens: TokenResponse) {
  sessionStorage.setItem('hellow_access_token', tokens.access_token);
  if (tokens.refresh_token) sessionStorage.setItem('hellow_refresh_token', tokens.refresh_token);
  if (tokens.id_token) sessionStorage.setItem('hellow_id_token', tokens.id_token);
  if (typeof tokens.expires_in === 'number' && Number.isFinite(tokens.expires_in)) {
    sessionStorage.setItem('hellow_token_expires_at', String(Date.now() + tokens.expires_in * 1000));
  } else sessionStorage.removeItem('hellow_token_expires_at');
}

export async function accessToken(force = false): Promise<string | null> {
  const token = sessionStorage.getItem('hellow_access_token');
  const refreshToken = sessionStorage.getItem('hellow_refresh_token');
  if (!token || !refreshToken) return token;
  if (renewal) return renewal;
  const expiresAt = Number(sessionStorage.getItem('hellow_token_expires_at'));
  if (!force && expiresAt > Date.now() + 60_000) return token;
  renewal = renew(token, refreshToken);
  try { return await renewal; } finally { renewal = null; }
}

async function renew(previous: string, refreshToken: string): Promise<string | null> {
  const configuration = await fetch('/api/platform/oidc-config', { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!configuration.ok) throw new Error('로그인 연결을 확인하지 못했습니다. 다시 시도해 주세요.');
  const { issuer, clientId } = await configuration.json();
  if (typeof issuer !== 'string' || typeof clientId !== 'string') throw new Error('로그인 설정을 확인하지 못했습니다.');
  const response = await fetch(`${issuer.replace(/\/$/, '')}/protocol/openid-connect/token`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken }),
  });
  // A late renewal must never restore a logged-out session or replace a new login.
  if (sessionStorage.getItem('hellow_access_token') !== previous || sessionStorage.getItem('hellow_refresh_token') !== refreshToken) {
    throw new SessionExpiredError();
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    if (response.status === 401 || error?.error === 'invalid_grant') {
      clearAuthentication();
      throw new SessionExpiredError();
    }
    throw new Error('로그인 연결이 일시적으로 지연되었습니다. 다시 시도해 주세요.');
  }
  const tokens: TokenResponse = await response.json();
  if (!tokens.access_token || tokens.token_type?.toLowerCase() !== 'bearer') {
    throw new Error('로그인 갱신 응답을 확인하지 못했습니다.');
  }
  if (sessionStorage.getItem('hellow_access_token') !== previous || sessionStorage.getItem('hellow_refresh_token') !== refreshToken) {
    throw new SessionExpiredError();
  }
  storeTokens(tokens);
  return tokens.access_token;
}
