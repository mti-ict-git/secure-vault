import type { FastifyInstance } from "fastify";
import { listAuditsFiltered } from "../repo/audit.js";
import { isAdminUser } from "../repo/users.js";

export const adminRoutes = async (app: FastifyInstance) => {
  app.get("/audit", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const isAdmin = await isAdminUser(userId);
    if (!isAdmin) return reply.status(403).send({ error: "forbidden" });
    type Query = { actor_id?: string; since?: string; until?: string };
    const q = req.query as Query | undefined;
    const items = await listAuditsFiltered({ actor_user_id: q?.actor_id, since: q?.since, until: q?.until });
    return reply.send({ items });
  });
};

