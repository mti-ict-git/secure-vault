import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { updateThemePreference, type ThemePreference } from "@/lib/auth";
import { loginLdap, logout as doLogout } from "@/lib/auth";
import { request } from "@/lib/api";
import { AuthContext, type AuthContextValue, type AuthUser } from "@/contexts/auth";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [jwt, setJwt] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser>(null);
  const { setTheme, theme } = useTheme();

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
  }, [setTheme]);

  useEffect(() => {
    const t = theme as ThemePreference | undefined;
    if (!jwt || !user || !t) return;
    const current = (user as { theme_preference?: ThemePreference }).theme_preference;
    if (current === t) return;
    void updateThemePreference(t).then((res) => {
      if (res.ok) {
        setUser((prev) => (prev ? { ...prev, theme_preference: t } : prev));
      }
    });
  }, [jwt, user, theme]);

  useEffect(() => {
    const t = localStorage.getItem("sv.jwt");
    if (!t) return;

    request<{ id?: string; display_name?: string; email?: string; theme_preference?: "light" | "dark" | "system"; role?: "user" | "admin" }>("/me", { headers: { Authorization: `Bearer ${t}` } }).then((res) => {
      if (res.ok && res.body?.id) {
        setJwt(t);
        const u = {
          id: res.body.id,
          display_name: res.body.display_name,
          theme_preference: res.body.theme_preference,
          role: res.body.role,
        } as AuthUser;
        setUser(u);
        if (u && u.theme_preference) {
          setTheme(u.theme_preference);
        }
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

    const me = await request<{ id?: string; display_name?: string; email?: string; theme_preference?: "light" | "dark" | "system"; role?: "user" | "admin" }>("/me", {
      headers: { Authorization: `Bearer ${r.token}` },
    });
    if (!me.ok || !me.body?.id) {
      doLogout();
      setJwt(null);
      setUser(null);
      return { ok: false, error: "login_failed" };
    }

    setJwt(r.token);
    const u = r.user || { id: me.body.id, display_name: me.body.display_name, theme_preference: me.body.theme_preference, role: me.body.role };
    setUser(u);
    if (u && (u as { theme_preference?: "light" | "dark" | "system" }).theme_preference) {
      setTheme((u as { theme_preference?: "light" | "dark" | "system" }).theme_preference!);
    }
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
    [user, jwt, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
