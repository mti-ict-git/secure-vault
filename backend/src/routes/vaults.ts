import type { FastifyInstance } from "fastify";
import { CreateVaultSchema } from "../utils/validators.js";
import { createVault, listVaultsForUser, getVault } from "../repo/vaults.js";
import { writeAudit } from "../repo/audit.js";

export const vaultRoutes = async (app: FastifyInstance) => {
  app.post("/", async (req, reply) => {
    const body = CreateVaultSchema.parse(req.body);
    const owner = body.kind === "personal" ? req.user?.id || null : null;
    const id = await createVault(owner, body.team_id || null, body.kind, body.version, body.vault_key_wrapped);
    await writeAudit(req.user?.id || null, "vault_create", "vault", id, { kind: body.kind });
    return reply.status(201).send({ id });
  });
  app.get("/", async (_req, reply) => {
    const userId = _req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const items = await listVaultsForUser(userId);
    return reply.send({ items });
  });
  app.get("/:id", async (req, reply) => {
    type Params = { id: string };
    const id = (req.params as Params).id;
    const v = await getVault(id);
    if (!v) return reply.status(404).send({ error: "not_found" });
    return reply.send(v);
  });
};
