import type { FastifyInstance } from "fastify";
import { LoginSchema } from "../utils/validators.js";
import { signJwt } from "../utils/jwt.js";
import { store, uid } from "../state/store.js";
import { ldapLogin } from "../auth/ldap.js";
import { ensureUser, createSession, getUserById } from "../repo/users.js";

export const authRoutes = async (app: FastifyInstance) => {
  app.post("/ldap/login", async (req, reply) => {
    try {
      const body = LoginSchema.parse(req.body);
      let id = uid();
      const ldapUser = await ldapLogin(body.username, body.password);
      id = await ensureUser(body.username, ldapUser.email, ldapUser.dn);
      const sessionId = await createSession(id);
      const token = signJwt({ sub: id, sid: sessionId });
      const u = await getUserById(id);
      return reply.send({ token, user: { id, display_name: u?.display_name || body.username } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "user_not_found") return reply.status(404).send({ error: "user_not_found" });
      if (msg === "invalid_credentials") return reply.status(401).send({ error: "invalid_credentials" });
      if (msg === "bind_failed") return reply.status(401).send({ error: "invalid_credentials" });
      if (msg === "ldap_unavailable") return reply.status(503).send({ error: "ldap_unavailable" });
      return reply.status(503).send({ error: "ldap_unavailable" });
    }
  });
  app.post("/logout", async (req, reply) => {
    return reply.send({ ok: true });
  });
  app.post("/refresh", async (req, reply) => {
    const token = signJwt({ sub: "placeholder" });
    return reply.send({ token });
  });
};
