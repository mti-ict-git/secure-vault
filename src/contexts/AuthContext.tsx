import { useEffect, useMemo, useState } from "react";
import { loginLdap, logout as doLogout } from "@/lib/auth";
import { request } from "@/lib/api";
import { AuthContext, type AuthContextValue, type AuthUser } from "@/contexts/auth";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [jwt, setJwt] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser>(null);

  useEffect(() => {
    const onUnauthorized = (ev: Event) => {
      const detail = (ev as CustomEvent<{ path?: string; error?: string } | undefined>).detail;
      if (detail?.error) {
        console.warn(`API unauthorized (${detail.error}) for ${detail.path || "unknown"}`);
      }
      doLogout();
      setJwt(null);
      setUser(null);
    };

    window.addEventListener("sv:unauthorized", onUnauthorized);
    return () => window.removeEventListener("sv:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("sv.jwt");
    if (!t) return;

    request<{ id?: string }>("/me", { headers: { Authorization: `Bearer ${t}` } }).then((res) => {
      if (res.ok && res.body?.id) {
        setJwt(t);
        setUser({ id: res.body.id });
        return;
      }
      doLogout();
      setJwt(null);
      setUser(null);
    });
  }, []);

  const login = async (username: string, password: string) => {
    const r = await loginLdap(username, password);
    if (r.ok === false) return { ok: false, error: r.error };

    const me = await request<{ id?: string }>("/me", {
      headers: { Authorization: `Bearer ${r.token}` },
    });
    if (!me.ok || !me.body?.id) {
      doLogout();
      setJwt(null);
      setUser(null);
      return { ok: false, error: "login_failed" };
    }

    setJwt(r.token);
    setUser(r.user || { id: me.body.id });
    return { ok: true };
  };

  const logout = () => {
    doLogout();
    setJwt(null);
    setUser(null);
  };

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      jwt,
      isAuthenticated: !!jwt,
      login,
      logout,
    }),
    [user, jwt]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
