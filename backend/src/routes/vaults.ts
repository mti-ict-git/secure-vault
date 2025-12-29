import type { FastifyInstance } from "fastify";
import { CreateVaultSchema } from "../utils/validators.js";
import { canUserAccessVault, createVault, listVaultsForUser, getVault } from "../repo/vaults.js";
import { getUserRoleInTeam } from "../repo/teams.js";
import { writeAudit } from "../repo/audit.js";
import { publishSyncEvent } from "../state/store.js";

export const vaultRoutes = async (app: FastifyInstance) => {
  app.post("/", async (req, reply) => {
    const body = CreateVaultSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    if (body.kind === "team" && !body.team_id) {
      return reply.status(400).send({ error: "team_id_required" });
    }
    if (body.kind === "team" && body.team_id) {
      const role = await getUserRoleInTeam(body.team_id, userId);
      if (!role || (role !== "owner" && role !== "admin" && role !== "editor")) {
        return reply.status(403).send({ error: "forbidden" });
      }
    }
    const owner = body.kind === "personal" ? userId : null;
    const id = await createVault(owner, body.team_id || null, body.kind, body.version, body.vault_key_wrapped);
    await writeAudit(userId, "vault_create", "vault", id, { kind: body.kind });
    publishSyncEvent({ t: Date.now(), type: "vault_create", vault_id: id, team_id: body.team_id, actor_user_id: userId });
    return reply.status(201).send({ id });
  });
  app.get("/", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    try {
      const items = await listVaultsForUser(userId);
      return reply.send({ items });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      req.log.error({ err: msg }, "listVaultsForUser failed");
      return reply.status(500).send({ error: "internal_error" });
    }
  });
  app.get("/:id", async (req, reply) => {
    type Params = { id: string };
    const id = (req.params as Params).id;
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const ok = await canUserAccessVault(id, userId);
    if (!ok) return reply.status(403).send({ error: "forbidden" });
    const v = await getVault(id);
    if (!v) return reply.status(404).send({ error: "not_found" });
    return reply.send(v);
  });
};
