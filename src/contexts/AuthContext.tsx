import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginLdap, logout as doLogout } from "@/lib/auth";
import { get } from "@/lib/api";

type AuthUser = { id: string; display_name?: string } | null;

type AuthContextValue = {
  user: AuthUser;
  jwt: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  jwt: null,
  isAuthenticated: false,
  login: async () => ({ ok: false }),
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [jwt, setJwt] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser>(null);

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
    if (r.ok) {
      setJwt(r.token);
      setUser(r.user || null);
      return { ok: true };
    }
    return { ok: false, error: r.error };
  };

  const logout = () => {
    doLogout();
    setJwt(null);
    setUser(null);
  };

  const value = useMemo(
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

export const useAuth = () => useContext(AuthContext);
