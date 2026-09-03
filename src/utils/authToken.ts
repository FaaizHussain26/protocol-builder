// Plain (non-component) auth helpers, split out from auth.tsx so that file can
// export only the Provider/hook (mixing component + non-component exports in
// one file breaks React Fast Refresh).
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'builder' | 'site';
  active: boolean;
}

const TOKEN_KEY = 'pb_auth_token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode */ }
}

export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
}

// api.ts's req() fires this on any 401 so every logged-in view reacts, without
// api.ts needing to import the React context directly.
export const UNAUTHORIZED_EVENT = 'pb:unauthorized';
export function reportUnauthorized(): void {
  clearToken();
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
