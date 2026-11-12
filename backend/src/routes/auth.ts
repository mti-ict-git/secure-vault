import type { FastifyInstance } from "fastify";
import { LoginSchema } from "../utils/validators.js";
import { signJwt } from "../utils/jwt.js";
import { store, uid } from "../state/store.js";
import { ldapLogin } from "../auth/ldap.js";
import { ensureUser, createSession, getUserById, revokeSession } from "../repo/users.js";
import { writeAudit } from "../repo/audit.js";

export const authRoutes = async (app: FastifyInstance) => {
  // Always rate-limited, independent of NODE_ENV and of the private-IP allowlist:
  // 10 attempts per 15 minutes per client IP + username.
  const loginRouteOpts = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: 15 * 60 * 1000,
        hook: "preHandler" as const,
        allowList: () => false,
        keyGenerator: (req: { ip: string; body?: unknown }) =>
          `${req.ip}|${String((req.body as { username?: unknown } | undefined)?.username ?? "").toLowerCase()}`,
      },
    },
  };
  app.post("/ldap/login", loginRouteOpts, async (req, reply) => {
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
    const sid = req.user?.sid;
    if (sid) {
      await revokeSession(sid);
      await writeAudit(req.user?.id ?? null, "auth_logout", "user", req.user?.id ?? null, {});
    }
    return reply.send({ ok: true });
  });
};
