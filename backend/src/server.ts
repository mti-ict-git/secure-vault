import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { registerRoutes } from "./urls.js";
import { pingDb } from "./db/mssql.js";
import { jwtGuard } from "./plugins/jwtGuard.js";

export const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
});

await server.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (config.corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error("origin not allowed"), false);
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

await server.register(jwtGuard);
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
