import type { FastifyInstance } from "fastify";
import { ShareSchema } from "../utils/validators.js";
import { store, uid } from "../state/store.js";

export const shareRoutes = async (app: FastifyInstance) => {
  app.post("/", async (req, reply) => {
    const body = ShareSchema.parse(req.body);
    const id = uid();
    store.shares.set(id, {
      id,
      source_vault_id: body.source_vault_id,
      target_user_id: body.target_user_id,
      target_team_id: body.target_team_id,
      wrapped_key: body.wrapped_key,
      permissions: body.permissions,
      created_at: Date.now(),
    });
    return reply.status(201).send({ id });
  });
};
