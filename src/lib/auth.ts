import { post, request } from "./api";

type LoginUser = { id: string; display_name?: string };
type LoginResponseBody = { token?: string; user?: LoginUser; error?: string };

export type LoginResult =
  | { ok: true; token: string; user?: LoginUser }
  | { ok: false; error: string };

export const loginLdap = async (username: string, password: string): Promise<LoginResult> => {
  const r = await post<LoginResponseBody>("/auth/ldap/login", { username, password });
  const token = r.body?.token;
  const user = r.body?.user;
  if (r.ok && token) {
    localStorage.setItem("sv.jwt", token);
    return { ok: true, token, user };
  }
  return { ok: false, error: r.body?.error || "login_failed" };
};

export const logout = () => {
  localStorage.removeItem("sv.jwt");
};

export type ThemePreference = "light" | "dark" | "system";

export const updateThemePreference = async (theme: ThemePreference): Promise<{ ok: boolean }> => {
  const r = await request("/me", { method: "PATCH", body: JSON.stringify({ theme }) });
  return { ok: r.ok };
};
