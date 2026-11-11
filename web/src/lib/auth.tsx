"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api, getToken, setToken } from "./api";
import type { Company, User } from "./types";

interface AuthState {
  user: User | null;
  company: Company | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setCompany: (c: Company | null) => void;
}

const AuthCtx = createContext<AuthState>({
  user: null,
  company: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
  setCompany: () => {},
});

export const useAuth = () => useContext(AuthCtx);

function readStored<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function store(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(key, JSON.stringify(value));
  else window.localStorage.removeItem(key);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const setCompany = useCallback((c: Company | null) => {
    setCompanyState(c);
    store("cs_company", c);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user?: User; company?: Company } & User>("/auth/me");
      const me = (data as { user?: User }).user ?? (data as User);
      const comp =
        (data as { company?: Company }).company ?? (me as User).company ?? null;
      setUser(me);
      store("cs_user", me);
      if (comp) setCompany(comp);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setCompany]);

  useEffect(() => {
    setUser(readStored<User>("cs_user"));
    setCompanyState(readStored<Company>("cs_company"));
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await api<{ token: string; user: User; company?: Company }>(
        "/auth/login",
        { method: "POST", body: { email, password } }
      );
      setToken(data.token);
      setUser(data.user);
      store("cs_user", data.user);
      const comp = data.company ?? data.user.company ?? null;
      if (comp) setCompany(comp);
    },
    [setCompany]
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* token may already be invalid */
    }
    setToken(null);
    setUser(null);
    store("cs_user", null);
    setCompany(null);
    router.replace("/login");
  }, [router, setCompany]);

  return (
    <AuthCtx.Provider
      value={{ user, company, loading, login, logout, refresh, setCompany }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function canDecide(role?: string | null): boolean {
  return role === "owner" || role === "mlro";
}
