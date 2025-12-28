import type { FastifyInstance } from "fastify";
import { listAudits } from "../repo/audit.js";

export const meRoutes = async (app: FastifyInstance) => {
  app.get("/me", async (_req, reply) => {
    const userId = _req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    return reply.send({ id: userId });
  });
  app.get("/audit", async (_req, reply) => {
    const items = await listAudits(_req.user?.id);
    return reply.send({ items });
  });
};
