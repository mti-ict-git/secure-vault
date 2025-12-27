import type { FastifyInstance } from "fastify";

export const syncRoutes = async (app: FastifyInstance) => {
  app.get("/events", async (req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders();
    const write = (d: unknown) =>
      reply.raw.write(`data: ${JSON.stringify(d)}\n\n`);
    const interval = setInterval(() => write({ t: Date.now() }), 10000);
    req.raw.on("close", () => {
      clearInterval(interval);
      reply.raw.end();
    });
  });
};
