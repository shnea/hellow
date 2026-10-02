/**
 * SHNEA Keycloak OIDC PKCE (S256) Helper
 */

// Base64URL 인코딩
function base64UrlEncode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// 랜덤 문자열 생성 (Code Verifier, State, Nonce)
export function generateRandomString(length: number = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

// SHA-256 해시 생성 (Code Challenge S256)
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

export interface OidcAuthConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scopes?: string;
  prompt?: string;
}

// Keycloak 로그인 URL 빌드
export async function buildAuthorizationUrl(config: OidcAuthConfig): Promise<{ url: string; state: string; nonce: string; verifier: string }> {
  const verifier = generateRandomString(64);
  const state = generateRandomString(32);
  const nonce = generateRandomString(32);
  const challenge = await generateCodeChallenge(verifier);

  // 세션 스토리지에 verifier, state, nonce 임시 보관
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oidc_verifier', verifier);
    sessionStorage.setItem('oidc_state', state);
    sessionStorage.setItem('oidc_nonce', nonce);
  }

  const authEndpoint = `${config.issuer.replace(/\/$/, '')}/protocol/openid-connect/auth`;
  const params = new URLSearchParams({
    client_id: config.clientId || 'app',
    response_type: 'code',
    scope: config.scopes || 'openid profile email',
    redirect_uri: config.redirectUri,
    state: state,
    nonce: nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: config.prompt || 'login', // 자동 로그인 방지 및 항상 Keycloak 로그인 화면 강제
  });

  return {
    url: `${authEndpoint}?${params.toString()}`,
    state,
    nonce,
    verifier,
  };
}

// 인가 코드(Code)를 토큰으로 교환
export async function exchangeCodeForToken(
  issuer: string,
  clientId: string,
  code: string,
  redirectUri: string,
  verifier: string
): Promise<{access_token:string;id_token?:string;expires_in:number;token_type:string}> {
  const tokenEndpoint = `${issuer.replace(/\/$/, '')}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`토큰 발급 실패: ${res.status} ${errorText}`);
  }

  return res.json();
}

// Keycloak OIDC 로그아웃 URL 빌드 (RP-Initiated Logout)
export function buildLogoutUrl(
  issuer: string,
  clientId: string,
  postLogoutRedirectUri: string,
  idToken?: string | null
): string {
  const logoutEndpoint = `${issuer.replace(/\/$/, '')}/protocol/openid-connect/logout`;
  const params = new URLSearchParams({
    client_id: clientId || 'app',
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
  if (idToken) {
    params.set('id_token_hint', idToken);
  }
  return `${logoutEndpoint}?${params.toString()}`;
}
