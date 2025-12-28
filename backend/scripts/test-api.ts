const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
};

const run = async () => {
  const health = await fetchJson("http://localhost:8082/health");
  console.log("health", health);
  if (!health.ok) throw new Error("backend health failed");
  const login = await fetchJson("http://localhost:8082/auth/ldap/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "demo", password: "demo" }),
  });
  console.log("login", !!login.token);
  if (!login.token) throw new Error("login failed");
  const keys = await fetchJson("http://localhost:8082/keys/me", {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  console.log("keys", keys);
  console.log("OK");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
