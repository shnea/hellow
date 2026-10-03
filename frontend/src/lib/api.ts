import { accessToken, SessionExpiredError } from './auth-session';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const organization = sessionStorage.getItem('hellow_organization_id');
  if (organization && !headers.has('X-Organization-ID')) headers.set('X-Organization-ID', organization);
  try {
    const token = await accessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(path, { ...options, headers, cache: 'no-store' });
    if (response.status !== 401 || !token || !sessionStorage.getItem('hellow_refresh_token')) return response;
    const current = sessionStorage.getItem('hellow_access_token');
    const refreshed = current !== token ? current : await accessToken(true);
    if (!refreshed) return response;
    headers.set('Authorization', `Bearer ${refreshed}`);
    return fetch(path, { ...options, headers, cache: 'no-store' });
  } catch (error) {
    if (error instanceof SessionExpiredError) throw new ApiError(401, error.message);
    throw error;
  }
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.detail || (response.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : response.status === 403 ? '이 조직에서 작업할 권한이 없습니다.' : '요청을 처리하지 못했습니다. 다시 시도해 주세요.');
    throw new ApiError(response.status, message);
  }
  // Spring의 void 응답은 200이어도 본문이 없다. 성공한 명령을 JSON 오류로 바꾸지 않는다.
  const body = await response.text();
  return body.trim() ? JSON.parse(body) as T : null as T;
}

export function jsonBody(data: unknown, method = 'POST'): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}
