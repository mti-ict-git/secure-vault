import type { FastifyInstance } from "fastify";
import { KeysRegisterSchema } from "../utils/validators.js";
import { clearKeys, getKeys, upsertKeys } from "../repo/users.js";
import { writeAudit } from "../repo/audit.js";

export const keysRoutes = async (app: FastifyInstance) => {
  app.post("/register", async (req, reply) => {
    const body = KeysRegisterSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const existing = (await getKeys(userId)) as { encrypted_private_key?: string | null } | null;
    if (existing?.encrypted_private_key) {
      // Overwriting would make every vault key wrapped for the old key pair undecryptable.
      // Re-registration requires an explicit POST /keys/reset first.
      return reply.status(409).send({ error: "keys_already_registered" });
    }
    await upsertKeys(
      userId,
      body.public_sign_key,
      body.public_enc_key,
      body.encrypted_private_key
    );
    await writeAudit(
      userId,
      "keys_register",
      "user",
      userId,
      {
        public_sign_key_b64_len: body.public_sign_key.length,
        public_enc_key_b64_len: body.public_enc_key.length,
      }
    );
    return reply.send({ ok: true });
  });
  app.get("/me", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const keys = await getKeys(userId);
    return reply.send(keys || {});
  });

  app.post("/reset", async (req, reply) => {
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    await clearKeys(userId);
    return reply.send({ ok: true });
  });
};
