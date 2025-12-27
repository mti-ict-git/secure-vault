import type { FastifyInstance } from "fastify";
import { CreateVaultSchema } from "../utils/validators.js";
import { store, uid } from "../state/store.js";

export const vaultRoutes = async (app: FastifyInstance) => {
  app.post("/", async (req, reply) => {
    const body = CreateVaultSchema.parse(req.body);
    const id = uid();
    const now = Date.now();
    store.vaults.set(id, {
      id,
      owner_user_id: undefined,
      team_id: body.team_id,
      kind: body.kind,
      version: body.version,
      vault_key_wrapped: body.vault_key_wrapped,
      created_at: now,
      updated_at: now,
    });
    return reply.status(201).send({ id });
  });
  app.get("/", async (_req, reply) => {
    const items = Array.from(store.vaults.values());
    return reply.send({ items });
  });
  app.get("/:id", async (req, reply) => {
    const id = (req.params as any).id as string;
    const v = store.vaults.get(id);
    if (!v) return reply.status(404).send({ error: "not_found" });
    return reply.send(v);
  });
};
