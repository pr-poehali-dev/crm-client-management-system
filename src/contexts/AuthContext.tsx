import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import func2url from "../../backend/func2url.json";

const AUTH_URL = (func2url as Record<string, string>)["auth"];
const SESSION_KEY = "crm_session_token";

export interface AuthUser {
  id: number;
  login: string;
  fullName: string;
  role: "admin" | "employee";
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchWithRetry(url: string, options: RequestInit, retries = 5, delayMs = 3000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      console.error("Fetch error:", e, "for", url);
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Failed after retries");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) { setLoading(false); return; }
    fetchWithRetry(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": saved },
      body: JSON.stringify({ action: "me" }),
    })
      .then((r) => r.json())
      .then((data) => {
        const d = typeof data === "string" ? JSON.parse(data) : data;
        if (d.user) { setUser(d.user); setToken(saved); }
        else localStorage.removeItem(SESSION_KEY);
      })
      .catch(() => localStorage.removeItem(SESSION_KEY))
      .finally(() => { setLoading(false); });
  }, []);

  const login = async (loginVal: string, password: string): Promise<string | null> => {
    try {
      const res = await fetchWithRetry(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", login: loginVal, password }),
      });
      let data = await res.json();
      if (typeof data === "string") data = JSON.parse(data);
      if (!res.ok) return data.error || "Ошибка входа";
      localStorage.setItem(SESSION_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      return null;
    } catch (e) {
      return "Сервер не отвечает. Попробуйте ещё раз.";
    }
  };

  const logout = async () => {
    if (token) {
      await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Id": token },
        body: JSON.stringify({ action: "logout" }),
      }).catch(() => {});
    }
    localStorage.removeItem(SESSION_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}