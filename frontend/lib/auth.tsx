'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, clearToken, getToken, setToken } from './api';
import type { User } from './types';
import { useTheme } from './theme';

interface AuthContextValue {
  user: User | null;
  /** True until the initial `/auth/me` check resolves. */
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { setPreference } = useTheme();

  // Restore the session on mount. A stale token resolves to null rather than
  // throwing, so the app falls through to the login screen cleanly.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch<{ user: User }>('/api/auth/me', { silent401: true })
      .then(({ user: me }) => {
        setUser(me);
        setPreference(me.theme);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
    // `setPreference` is stable; re-running on it would refetch needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        silent401: true,
      });
      setToken(result.token);
      setUser(result.user);
      setPreference(result.user.theme);
      router.push('/dashboard');
    },
    [router, setPreference],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await apiFetch<{ token: string; user: User }>('/api/auth/signup', {
        method: 'POST',
        body: { name, email, password },
        silent401: true,
      });
      setToken(result.token);
      setUser(result.user);
      router.push('/dashboard');
    },
    [router],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    router.push('/login');
  }, [router]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'ADMIN',
      login,
      signup,
      logout,
      updateUser,
    }),
    [user, loading, login, signup, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
