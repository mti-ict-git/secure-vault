import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { registerRoutes } from "./urls.js";
import { pingDb } from "./db/mssql.js";
import { installJwtGuard } from "./plugins/jwtGuard.js";

export const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
});

await server.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (config.corsOrigins.includes("*")) return cb(null, true);
    if (config.corsOrigins.includes(origin)) return cb(null, true);

    const originUrl = (() => {
      try {
        return new URL(origin);
      } catch {
        return null;
      }
    })();

    const originHost = originUrl?.hostname;
    const originPort = originUrl?.port;
    const originHostPort =
      originHost && originPort ? `${originHost}:${originPort}` : originHost;

    const matches = config.corsOrigins.some((allowed) => {
      if (!allowed) return false;
      if (allowed === origin) return true;

      const allowedUrl = (() => {
        try {
          return new URL(allowed);
        } catch {
          return null;
        }
      })();

      if (allowedUrl) {
        const allowedHostPort =
          allowedUrl.hostname && allowedUrl.port
            ? `${allowedUrl.hostname}:${allowedUrl.port}`
            : allowedUrl.hostname;
        return !!originHostPort && allowedHostPort === originHostPort;
      }

      if (!originHostPort || !originHost) return false;

      const allowedHostPort = allowed.toLowerCase().trim();
      const allowedHost = allowedHostPort.split(":")[0] || "";

      if (allowedHostPort === originHostPort.toLowerCase()) return true;
      if (allowedHost === originHost.toLowerCase()) return true;
      if (allowedHost.startsWith(".") && originHost.toLowerCase().endsWith(allowedHost)) return true;

      return false;
    });

    if (matches) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
});
await server.register(rateLimit, {
  timeWindow: config.rateLimit.windowMs,
  max: config.rateLimit.max,
});

await server.route({
  method: "GET",
  url: "/health",
  handler: async () => {
    return { ok: true };
  },
});

installJwtGuard(server);
await registerRoutes(server);

await server.route({
  method: "GET",
  url: "/health/db",
  handler: async (_req, reply) => {
    try {
      const ok = await pingDb();
      return reply.send({ ok });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({ ok: false, error: msg });
    }
  },
});
