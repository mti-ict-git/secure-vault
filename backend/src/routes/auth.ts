import type { FastifyInstance } from "fastify";
import { LoginSchema } from "../utils/validators.js";
import { signJwt } from "../utils/jwt.js";
import { store, uid } from "../state/store.js";
import { ldapLogin } from "../auth/ldap.js";

export const authRoutes = async (app: FastifyInstance) => {
  app.post("/ldap/login", async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    let id = uid();
    const ldapUser = await ldapLogin(body.username, body.password);
    const user = { id, display_name: body.username, email: ldapUser.email };
    store.users.set(id, user);
    const sessionId = uid();
    store.sessions.set(sessionId, {
      id: sessionId,
      user_id: id,
      created_at: Date.now(),
    });
    const token = signJwt({ sub: id, sid: sessionId });
    return reply.send({ token, user: { id, display_name: user.display_name } });
  });
  app.post("/logout", async (req, reply) => {
    return reply.send({ ok: true });
  });
  app.post("/refresh", async (req, reply) => {
    const token = signJwt({ sub: "placeholder" });
    return reply.send({ token });
  });
};
