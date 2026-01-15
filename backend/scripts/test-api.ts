import dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(process.cwd(), ".env") });
dotenv.config({ path: join(process.cwd(), "..", ".env") });

type FetchJsonResult = { status: number; ok: boolean; body: unknown };

const fetchJson = async (url: string, init?: RequestInit): Promise<FetchJsonResult> => {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { text };
  }
  return { status: res.status, ok: res.ok, body };
};

type LoginOk = { token: string };
type LoginErr = { error?: string };

const isLoginOk = (v: unknown): v is LoginOk => {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.token === "string";
};

const getLoginError = (v: unknown): string => {
  if (typeof v !== "object" || v === null) return "unknown";
  const r = v as Record<string, unknown>;
  const e = r.error;
  return typeof e === "string" ? e : "unknown";
};

const run = async () => {
  const port = Number(process.env.BACKEND_PORT || process.env.PORT || 8084);
  const base = `http://localhost:${Number.isFinite(port) ? port : 8084}`;

  const health = await fetchJson(`${base}/health`);
  console.log("health", health.status, health.body);
  if (!health.ok) throw new Error("backend health failed");

  const ldapHealth = await fetchJson(`${base}/health/ldap`);
  console.log("health.ldap", ldapHealth.status, ldapHealth.body);

  const username = process.env.SV_TEST_USERNAME || "demo";
  const password = process.env.SV_TEST_PASSWORD || "demo";
  const loginRes = await fetchJson(`${base}/auth/ldap/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const ok = isLoginOk(loginRes.body);
  console.log("login", loginRes.status, ok ? "ok" : `fail:${getLoginError(loginRes.body)}`);
  if (!ok) throw new Error("login failed");

  const login = loginRes.body;
  if (!isLoginOk(login)) throw new Error("login token missing");

  const me = await fetchJson(`${base}/me`, {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  console.log("me", me.status, me.body);

  const keys = await fetchJson(`${base}/keys/me`, {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  console.log("keys", keys.status, keys.body);
  if (!keys.ok) throw new Error("keys failed");
  const vaults = await fetchJson(`${base}/vaults`, {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  console.log("vaults", vaults.status, vaults.body);
  if (!vaults.ok) throw new Error("vaults failed");
  console.log("OK");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
