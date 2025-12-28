import type { FastifyPluginAsync } from "fastify";
import { verifyJwt } from "../utils/jwt.js";
import { isSessionValid } from "../repo/users.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; sid: string };
  }
}

export const jwtGuard: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req, reply) => {
    const openPaths = ["/health", "/health/db", "/auth/ldap/login", "/sync/events"];
    const path = (req.url || "").split("?")[0];
    if (openPaths.includes(path)) return;
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    const token = auth.slice("Bearer ".length);
    let payload: unknown;
    try {
      payload = verifyJwt(token);
    } catch {
      return reply.status(401).send({ error: "invalid_token" });
    }
    const { sid, sub } = payload as { sid: string; sub: string };
    const valid = await isSessionValid(sid);
    if (!valid) return reply.status(401).send({ error: "session_revoked" });
    req.user = { id: sub, sid };
  });
};
