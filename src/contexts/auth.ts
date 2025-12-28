import { createContext, useContext } from "react";

export type AuthUser = { id: string; display_name?: string } | null;

export type AuthLoginResult = { ok: boolean; error?: string };

export type AuthContextValue = {
  user: AuthUser;
  jwt: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<AuthLoginResult>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  jwt: null,
  isAuthenticated: false,
  login: async () => ({ ok: false }),
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

