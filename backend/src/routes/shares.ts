import type { FastifyInstance } from "fastify";
import { ShareSchema } from "../utils/validators.js";
import { createShare } from "../repo/shares.js";
import { writeAudit } from "../repo/audit.js";
import { getVaultAccessForUser } from "../repo/vaults.js";
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
