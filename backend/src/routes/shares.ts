import type { FastifyInstance } from "fastify";
import { ShareSchema } from "../utils/validators.js";
import { createShare } from "../repo/shares.js";
import { writeAudit } from "../repo/audit.js";

export const shareRoutes = async (app: FastifyInstance) => {
  app.post("/", async (req, reply) => {
    const body = ShareSchema.parse(req.body);
    const id = await createShare(
      body.source_vault_id,
      body.target_user_id || null,
      body.target_team_id || null,
      body.wrapped_key,
      body.permissions
    );
    await writeAudit(req.user?.id || null, "vault_share", "vault", body.source_vault_id, { share_id: id });
    return reply.status(201).send({ id });
  });
};
