import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { registerRoutes } from "./urls.js";

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

await registerRoutes(server);
