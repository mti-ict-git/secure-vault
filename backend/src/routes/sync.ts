import type { FastifyInstance } from "fastify";
import { subscribeSyncEvents } from "../state/store.js";
import type { SyncEvent } from "../state/store.js";
import { isSessionValid } from "../repo/users.js";
import { canUserAccessVault } from "../repo/vaults.js";
import { isTeamMember } from "../repo/teams.js";
import { config } from "../config.js";
import { randomBytes } from "crypto";

// EventSource cannot send headers, so the stream is opened with a short-lived,
// single-use ticket instead of the JWT itself (which would land in proxy logs).
const TICKET_TTL_MS = 30_000;
const tickets = new Map<string, { sub: string; sid: string; exp: number }>();
const sweepTickets = () => {
  const now = Date.now();
  for (const [k, v] of tickets) if (v.exp < now) tickets.delete(k);
};

export const syncRoutes = async (app: FastifyInstance) => {
  // Authenticated by the JWT guard (Authorization header).
  app.post("/ticket", async (req, reply) => {
    const user = req.user;
    if (!user) return reply.status(401).send({ error: "unauthorized" });
    sweepTickets();
    const ticket = randomBytes(32).toString("base64url");
    tickets.set(ticket, { sub: user.id, sid: user.sid, exp: Date.now() + TICKET_TTL_MS });
    return reply.send({ ticket, expires_in: TICKET_TTL_MS / 1000 });
  });

  app.get(
    "/events",
    { config: { rateLimit: false } },
    async (req, reply) => {
    type Query = { ticket?: string };
    const ticket = (req.query as Query | undefined)?.ticket;
    if (!ticket) return reply.status(401).send({ error: "unauthorized" });
    const entry = tickets.get(ticket);
    tickets.delete(ticket);
    if (!entry || entry.exp < Date.now()) return reply.status(401).send({ error: "invalid_ticket" });
    const { sid, sub } = entry;
    const valid = await isSessionValid(sid);
    if (!valid) return reply.status(401).send({ error: "session_revoked" });
    const originHeader = (req.headers["origin"] || req.headers["Origin"]) as string | undefined;
    const isAllowedOrigin = (o: string): boolean => {
      if (config.corsOrigins.includes("*")) return true;
      if (config.corsOrigins.includes(o)) return true;
      try {
        const ou = new URL(o);
        const oHost = ou.hostname;
        const oPort = ou.port;
        const oHostPort = oPort ? `${oHost}:${oPort}` : oHost;
        return config.corsOrigins.some((a) => {
          if (!a) return false;
          if (a === o) return true;
          try {
            const au = new URL(a);
            const aHost = au.hostname;
            const aPort = au.port;
            const aHostPort = aPort ? `${aHost}:${aPort}` : aHost;
            return aHostPort.toLowerCase() === oHostPort.toLowerCase() || aHost.toLowerCase() === oHost.toLowerCase();
          } catch {
            const al = a.toLowerCase().trim();
            return al === oHostPort.toLowerCase() || al === oHost.toLowerCase();
          }
        });
      } catch {
        return false;
      }
    };
    if (originHeader && isAllowedOrigin(originHeader)) {
      reply.raw.setHeader("Access-Control-Allow-Origin", originHeader);
      reply.raw.setHeader("Vary", "Origin");
      reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
    }
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders();
    const write = (d: unknown) =>
      reply.raw.write(`data: ${JSON.stringify(d)}\n\n`);

    const canSeeEvent = async (evt: SyncEvent) => {
      if (evt.target_user_id) return evt.target_user_id.toLowerCase() === sub.toLowerCase();
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
    }
  );
};
