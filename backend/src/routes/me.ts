import type { FastifyInstance } from "fastify";
import { listAudits, listAuditsFiltered } from "../repo/audit.js";
import { writeAudit } from "../repo/audit.js";
import { getPublicKeysByUserId, getUserByEmail, getUserById, searchUsers, setThemePreference, ensureUser } from "../repo/users.js";
import { config } from "../config.js";
import { ThemeUpdateSchema } from "../utils/validators.js";
import { ldapFindByEmail, ldapSearchUsers } from "../auth/ldap.js";
import { dismissNotifications, listNotifications, markNotificationsRead } from "../repo/notifications.js";

// Directory lookups are keyed per signed-in user (the JWT guard runs before them).
const directoryRateLimit = (max: number) => ({
  config: {
    rateLimit: {
      max,
      timeWindow: 60_000,
      hook: "preHandler" as const,
      allowList: () => false,
      keyGenerator: (req: { ip: string; user?: { id: string } }) => `dir|${req.user?.id ?? req.ip}`,
    },
  },
});

// Actions the browser may record itself (things only the client sees, such as a copy
// to clipboard). Everything security-relevant (shares, revokes, key changes, logins)
// is written by the server and can never be forged through /audit/log.
const CLIENT_AUDIT_ACTIONS = new Set([
  "entry_create",
  "entry_update",
  "entry_delete",
  "entry_favorite",
  "entry_copy_to_team",
  "entry_copy_to_user",
  "folder_create",
  "folder_delete",
  "password_copy",
  "username_copy",
  "export_csv",
  "export_json",
  "export_kdbx",
  "import_kdbx",
  "vault_unlock",
  "vault_unlock_failed",
]);

export const meRoutes = async (app: FastifyInstance) => {
  const meRouteOpts = config.nodeEnv !== "production" ? { config: { rateLimit: { max: 1200, timeWindow: 60_000 } } } : {};
  app.get("/me", meRouteOpts, async (_req, reply) => {
    const userId = _req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const u = await getUserById(userId);
    if (!u) return reply.status(404).send({ error: "not_found" });
    return reply.send({ id: u.id, display_name: u.display_name, email: u.email, theme_preference: (u as { theme_preference?: string | null }).theme_preference, role: (u as { role?: string | null }).role });
  });

  app.patch("/me", meRouteOpts, async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const body = ThemeUpdateSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "invalid_body" });
    await setThemePreference(userId, body.data.theme);
    return reply.send({ ok: true });
  });
  app.get("/audit", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    type Query = { since?: string; until?: string; action?: string };
    const q = req.query as Query | undefined;
    const items = await listAuditsFiltered({ actor_user_id: userId, since: q?.since, until: q?.until, action: q?.action });
    return reply.send({ items });
  });
  app.post("/audit/log", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    type Body = { action: string; resource_type?: string; resource_id?: string; details?: unknown };
    const b = req.body as Body | undefined;
    const action = (b?.action || "").trim();
    if (!action) return reply.status(400).send({ error: "invalid_action" });
    if (!CLIENT_AUDIT_ACTIONS.has(action)) return reply.status(400).send({ error: "action_not_allowed" });
    const details = b?.details;
    if (details !== undefined && JSON.stringify(details).length > 2000) {
      return reply.status(400).send({ error: "details_too_large" });
    }
    const rid = (b?.resource_id || null) as string | null;
    const rtype = (b?.resource_type || null) as string | null;
    await writeAudit(userId, action, rtype, rid, details);
    return reply.send({ ok: true });
  });
  app.get("/users/:id/public-keys", async (req, reply) => {
    type Params = { id: string };
    const id = (req.params as Params).id;
    const u = await getPublicKeysByUserId(id);
    if (!u) return reply.status(404).send({ error: "not_found" });
    return reply.send(u);
  });

  app.get("/users/lookup", directoryRateLimit(20), async (req, reply) => {
    type Query = { email?: string };
    const email = (req.query as Query | undefined)?.email?.trim();
    if (!email) return reply.status(400).send({ error: "email_required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || email.length > 254) {
      return reply.status(400).send({ error: "invalid_email" });
    }
    const u = await getUserByEmail(email);
    if (u) return reply.send(u);
    if (config.ldap.url) {
      const d = await ldapFindByEmail(email);
      if (d && d.email) {
        const id = await ensureUser(d.displayName || d.email, d.email, d.dn);
        await writeAudit(req.user?.id ?? null, "user_provision", "user", id, { email: d.email, via: "lookup" });
        const created = await getUserById(id);
        if (created) return reply.send({ id: created.id, display_name: created.display_name, email: created.email });
      }
    }
    return reply.status(404).send({ error: "not_found" });
  });

  app.get("/users/search", directoryRateLimit(30), async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    type Query = { q?: string };
    const q = (req.query as Query | undefined)?.q || "";
    const term = q.trim();
    if (term.length < 2 || term.length > 64) return reply.send({ items: [] });
    const items = (await searchUsers(term)).slice(0, 10);
    // The AD directory is only searched from 3 characters, to stop it being listed wholesale.
    if (!config.ldap.url || term.length < 3) return reply.send({ items });
    const ldapItems = await ldapSearchUsers(term, 10);
    await writeAudit(userId, "directory_search", "user", null, { term_length: term.length, results: ldapItems.length });
    const byEmail = new Set(items.map((i) => (i.email || "").toLowerCase()).filter(Boolean));
    type SearchItem = { id?: string; display_name?: string | null; email?: string | null };
    const merged = (items as SearchItem[]).concat(
      ldapItems
        .filter((u) => !!u.email && !byEmail.has(u.email!.toLowerCase()))
        .map((u) => ({ id: undefined, display_name: u.displayName || undefined, email: u.email || undefined }))
    ).slice(0, 10);
    return reply.send({ items: merged });
  });

  app.get("/notifications", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    return reply.send({ items: await listNotifications(userId) });
  });
  app.post("/notifications/read", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    await markNotificationsRead(userId);
    return reply.send({ ok: true });
  });
  app.post("/notifications/dismiss", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    await dismissNotifications(userId);
    return reply.send({ ok: true });
  });
};
