import { useEffect, useMemo, useState } from "react";
import { loginLdap, logout as doLogout } from "@/lib/auth";
import { get } from "@/lib/api";
import { AuthContext, type AuthContextValue, type AuthUser } from "@/contexts/auth";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [jwt, setJwt] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser>(null);

  useEffect(() => {
    const onUnauthorized = () => {
      doLogout();
      setJwt(null);
      setUser(null);
    };

    window.addEventListener("sv:unauthorized", onUnauthorized);
    return () => window.removeEventListener("sv:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    const t = localStorage.getItem("sv.jwt");
    if (t) {
      setJwt(t);
      get<{ id?: string }>("/me").then((res) => {
        if (res.ok && res.body?.id) setUser({ id: res.body.id });
      });
    }
  }, []);

  const login = async (username: string, password: string) => {
    const r = await loginLdap(username, password);
    if (r.ok === false) return { ok: false, error: r.error };
    setJwt(r.token);
    setUser(r.user || null);
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
