import type { FastifyInstance } from "fastify";
import { KeysRegisterSchema } from "../utils/validators.js";
import { store } from "../state/store.js";

export const keysRoutes = async (app: FastifyInstance) => {
  app.post("/register", async (req, reply) => {
    const sub = (req.headers.authorization || "").replace("Bearer ", "");
    const body = KeysRegisterSchema.parse(req.body);
    const users = Array.from(store.users.values());
    const user = users[0];
    if (!user) return reply.status(401).send({ error: "unauthorized" });
    user.public_sign_key = body.public_sign_key;
    user.public_enc_key = body.public_enc_key;
    user.encrypted_private_key = body.encrypted_private_key;
    return reply.send({ ok: true });
  });
  app.get("/me", async (req, reply) => {
    const users = Array.from(store.users.values());
    const user = users[0];
    if (!user) return reply.status(401).send({ error: "unauthorized" });
    return reply.send({
      public_sign_key: user.public_sign_key,
      public_enc_key: user.public_enc_key,
      encrypted_private_key: user.encrypted_private_key,
    });
  });
};
