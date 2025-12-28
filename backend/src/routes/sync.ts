import type { FastifyInstance } from "fastify";
import { verifyJwt } from "../utils/jwt.js";
import { subscribeSyncEvents } from "../state/store.js";
import type { SyncEvent } from "../state/store.js";
import { isSessionValid } from "../repo/users.js";
import { canUserAccessVault } from "../repo/vaults.js";
import { isTeamMember } from "../repo/teams.js";

export const syncRoutes = async (app: FastifyInstance) => {
  app.get("/events", async (req, reply) => {
    type Query = { token?: string };
    const token = (req.query as Query | undefined)?.token;
    if (!token) return reply.status(401).send({ error: "unauthorized" });
    let sid: string;
    let sub: string;
    try {
      const payload = verifyJwt(token);
      const sidValue = payload.sid;
      const subValue = payload.sub;
      if (typeof sidValue !== "string" || typeof subValue !== "string") {
        return reply.status(401).send({ error: "invalid_token" });
      }
      sid = sidValue;
      sub = subValue;
    } catch {
      return reply.status(401).send({ error: "invalid_token" });
    }
    const valid = await isSessionValid(sid);
    if (!valid) return reply.status(401).send({ error: "session_revoked" });
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders();
    const write = (d: unknown) =>
      reply.raw.write(`data: ${JSON.stringify(d)}\n\n`);

    const canSeeEvent = async (evt: SyncEvent) => {
      if (evt.vault_id) return canUserAccessVault(evt.vault_id, sub);
      if (evt.team_id) return isTeamMember(evt.team_id, sub);
      return evt.actor_user_id === sub;
    };

    const stop = subscribeSyncEvents((evt) => {
      canSeeEvent(evt)
        .then((ok) => {
          if (ok) write(evt);
        })
        .catch(() => {
          return;
        });
    });
    const interval = setInterval(() => write({ t: Date.now(), type: "heartbeat" }), 30000);
    req.raw.on("close", () => {
      clearInterval(interval);
      stop();
      reply.raw.end();
    });
  });
};
