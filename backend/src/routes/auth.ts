import type { FastifyInstance } from "fastify";
import { LoginSchema } from "../utils/validators.js";
import { signJwt } from "../utils/jwt.js";
import { store, uid } from "../state/store.js";
import { ldapLogin } from "../auth/ldap.js";
import { ensureUser, createSession, getUserById } from "../repo/users.js";
import { writeAudit } from "../repo/audit.js";

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
      await writeAudit(id, "auth_login", "user", id, { username: body.username });
      return reply.send({ token, user: { id, display_name: u?.display_name || body.username } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      const name = typeof e === "object" && e !== null ? (e as { name?: unknown }).name : undefined;
      const detailMessage = e instanceof Error ? e.message : (typeof e === "object" && e !== null ? (e as { message?: unknown }).message : undefined);
      const detail = {
        name: typeof name === "string" ? name : undefined,
        message: typeof detailMessage === "string" ? detailMessage : undefined,
      };
      if (msg === "user_not_found") return reply.status(404).send({ error: "user_not_found", detail });
      if (msg === "invalid_credentials") return reply.status(401).send({ error: "invalid_credentials", detail });
      if (msg === "bind_failed") return reply.status(401).send({ error: "invalid_credentials", detail });
      if (msg === "ldap_unavailable") return reply.status(503).send({ error: "ldap_unavailable", detail });
      await writeAudit(null, "auth_login_failed", "user", null, { username: (req.body as { username?: string })?.username, message: msg });
      return reply.status(401).send({ error: "invalid_credentials", detail });
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
