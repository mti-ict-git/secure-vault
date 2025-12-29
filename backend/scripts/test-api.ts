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
  const health = await fetchJson("http://localhost:8082/health");
  console.log("health", health.status, health.body);
  if (!health.ok) throw new Error("backend health failed");

  const username = process.env.SV_TEST_USERNAME || "demo";
  const password = process.env.SV_TEST_PASSWORD || "demo";
  const loginRes = await fetchJson("http://localhost:8082/auth/ldap/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const ok = isLoginOk(loginRes.body);
  console.log("login", loginRes.status, ok ? "ok" : `fail:${getLoginError(loginRes.body)}`);
  if (!ok) throw new Error("login failed");

  const login = loginRes.body;
  if (!isLoginOk(login)) throw new Error("login token missing");

  const me = await fetchJson("http://localhost:8082/me", {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  console.log("me", me.status, me.body);

  const keys = await fetchJson("http://localhost:8082/keys/me", {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  console.log("keys", keys.status, keys.body);
  if (!keys.ok) throw new Error("keys failed");
  const vaults = await fetchJson("http://localhost:8082/vaults", {
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
