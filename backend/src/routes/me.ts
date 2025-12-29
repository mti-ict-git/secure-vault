import type { FastifyInstance } from "fastify";
import { listAudits } from "../repo/audit.js";
import { getPublicKeysByUserId, getUserByEmail, getUserById, setThemePreference } from "../repo/users.js";
import { ThemeUpdateSchema } from "../utils/validators.js";

export const meRoutes = async (app: FastifyInstance) => {
  app.get("/me", async (_req, reply) => {
    const userId = _req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const u = await getUserById(userId);
    if (!u) return reply.status(404).send({ error: "not_found" });
    return reply.send({ id: u.id, display_name: u.display_name, email: u.email, theme_preference: (u as { theme_preference?: string | null }).theme_preference });
  });

  app.patch("/me", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const body = ThemeUpdateSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: "invalid_body" });
    await setThemePreference(userId, body.data.theme);
    return reply.send({ ok: true });
  });
  app.get("/audit", async (_req, reply) => {
    const items = await listAudits(_req.user?.id);
    return reply.send({ items });
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
