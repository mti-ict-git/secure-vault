import type { FastifyInstance } from "fastify";
import { store } from "../state/store.js";

export const meRoutes = async (app: FastifyInstance) => {
  app.get("/me", async (_req, reply) => {
    const users = Array.from(store.users.values());
    const user = users[0];
    if (!user) return reply.status(401).send({ error: "unauthorized" });
    return reply.send({ id: user.id, display_name: user.display_name });
  });
  app.get("/audit", async (_req, reply) => {
    return reply.send({ items: [] });
  });
};
