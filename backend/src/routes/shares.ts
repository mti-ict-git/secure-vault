import type { FastifyInstance } from "fastify";
import { ShareSchema } from "../utils/validators.js";
import { createShare } from "../repo/shares.js";
import { writeAudit } from "../repo/audit.js";
import { getVault, getVaultAccessForUser } from "../repo/vaults.js";
import { publishSyncEvent } from "../state/store.js";

export const shareRoutes = async (app: FastifyInstance) => {
  app.post("/", async (req, reply) => {
    const body = ShareSchema.parse(req.body);
    const actorId = req.user?.id;
    if (!actorId) return reply.status(401).send({ error: "unauthorized" });
    const hasUserTarget = !!body.target_user_id;
    const hasTeamTarget = !!body.target_team_id;
    if (hasUserTarget === hasTeamTarget) {
      return reply.status(400).send({ error: "invalid_target" });
    }
    const access = await getVaultAccessForUser(body.source_vault_id, actorId);
    if (!access) return reply.status(404).send({ error: "not_found" });
    if (access.permissions !== "write") return reply.status(403).send({ error: "forbidden" });
    const vault = (await getVault(body.source_vault_id)) as
      | { kind?: string; purpose?: string; owner_user_id?: string | null }
      | null;
    if (!vault) return reply.status(404).send({ error: "not_found" });
    if (vault.kind === "personal") {
      // Never hand out the key of a primary personal vault. Only the owner may share
      // a transfer vault created by Copy to User.
      if (vault.purpose !== "transfer" || String(vault.owner_user_id).toLowerCase() !== actorId.toLowerCase()) {
        await writeAudit(actorId, "vault_share_blocked", "vault", body.source_vault_id, { target_user_id: body.target_user_id, target_team_id: body.target_team_id });
        return reply.status(403).send({ error: "personal_vault_not_shareable" });
      }
    }
    const id = await createShare(
      body.source_vault_id,
      body.target_user_id || null,
      body.target_team_id || null,
      body.wrapped_key,
      body.permissions
    );
    await writeAudit(actorId, "vault_share", "vault", body.source_vault_id, { share_id: id, target_user_id: body.target_user_id, target_team_id: body.target_team_id, permissions: body.permissions });
    publishSyncEvent({ t: Date.now(), type: "vault_share", vault_id: body.source_vault_id, actor_user_id: actorId });
    return reply.status(201).send({ id });
  });
};
