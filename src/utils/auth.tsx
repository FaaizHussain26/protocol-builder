// The auth context/provider. Replaces the old shared-passcode gate (PassLock)
// with real per-user identity. Token storage lives in authToken.ts (kept out of
// this file so it only exports the Provider component + the useAuth hook).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getToken, clearToken, setToken, UNAUTHORIZED_EVENT, type AuthUser } from './authToken';

export type { AuthUser };

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setSession: (user: AuthUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, fetchMe }: { children: ReactNode; fetchMe: () => Promise<AuthUser> }) {
  // No stored token → nothing to resolve, so start not-loading (avoids a
  // setState call inside the effect below for that branch).
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(() => !!getToken());

  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    fetchMe()
      .then((u) => { if (alive) setUser(u); })
      .catch(() => { clearToken(); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const setSession = (u: AuthUser, token: string) => { setToken(token); setUser(u); };
  const logout = () => { clearToken(); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
