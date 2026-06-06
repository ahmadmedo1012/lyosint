import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  telegramId: string;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  searchCount: number;
  isSubscribed: boolean;
  subscriptionExpiry?: string | null;
  canSearch: boolean;
  searchesRemaining?: number | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (telegramData: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  incrementSearch: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "lyosint_session";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options: RequestInit = {}, token?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) { setLoading(false); return; }
    try {
      const data = await apiFetch("/api/auth/me", {}, t);
      setUser(data);
      setToken(t);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = useCallback(async (telegramData: Record<string, string>) => {
    const data = await apiFetch("/api/auth/telegram", { method: "POST", body: JSON.stringify(telegramData) });
    localStorage.setItem(TOKEN_KEY, data.sessionToken);
    setToken(data.sessionToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      try { await apiFetch("/api/auth/logout", { method: "POST" }, t); } catch {}
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const incrementSearch = useCallback(() => {
    setUser((u) => {
      if (!u) return u;
      const newCount = u.searchCount + 1;
      const remaining = u.isSubscribed ? null : Math.max(0, 3 - newCount);
      return { ...u, searchCount: newCount, searchesRemaining: remaining, canSearch: u.isSubscribed || newCount < 3 };
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser, incrementSearch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
