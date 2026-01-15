import type { FastifyInstance } from "fastify";
import { listAudits, listAuditsFiltered } from "../repo/audit.js";
import { writeAudit } from "../repo/audit.js";
import { getPublicKeysByUserId, getUserByEmail, getUserById, setThemePreference } from "../repo/users.js";
import { ThemeUpdateSchema } from "../utils/validators.js";

export const meRoutes = async (app: FastifyInstance) => {
  app.get("/me", async (_req, reply) => {
    const userId = _req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const u = await getUserById(userId);
    if (!u) return reply.status(404).send({ error: "not_found" });
    return reply.send({ id: u.id, display_name: u.display_name, email: u.email, theme_preference: (u as { theme_preference?: string | null }).theme_preference, role: (u as { role?: string | null }).role });
  });

  app.patch("/me", async (req, reply) => {
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
    const rid = (b?.resource_id || null) as string | null;
    const rtype = (b?.resource_type || null) as string | null;
    await writeAudit(userId, action, rtype, rid, b?.details);
    return reply.send({ ok: true });
  });
  app.get("/users/:id/public-keys", async (req, reply) => {
    type Params = { id: string };
    const id = (req.params as Params).id;
    const u = await getPublicKeysByUserId(id);
    if (!u) return reply.status(404).send({ error: "not_found" });
    return reply.send(u);
  });

  app.get("/users/lookup", async (req, reply) => {
    type Query = { email?: string };
    const email = (req.query as Query | undefined)?.email;
    if (!email) return reply.status(400).send({ error: "email_required" });
    const u = await getUserByEmail(email);
    if (!u) return reply.status(404).send({ error: "not_found" });
    return reply.send(u);
  });
};
