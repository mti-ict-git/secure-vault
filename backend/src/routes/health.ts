import type { FastifyInstance } from "fastify";
import { Client } from "ldapts";
import { config } from "../config.js";

export const healthRoutes = async (app: FastifyInstance) => {
  app.get("/ldap", async (_req, reply) => {
    if (!config.ldap.url) return reply.status(503).send({ ok: false, error: "ldap_unconfigured" });
    const client = new Client({
      url: config.ldap.url,
      timeout: config.ldap.timeout,
      connectTimeout: config.ldap.connectTimeout,
      tlsOptions: { rejectUnauthorized: config.ldap.tlsRejectUnauthorized },
    });
    try {
      await client.bind(config.ldap.bindDN, config.ldap.bindPassword);
      await client.unbind();
      return reply.send({ ok: true });
    } catch (e: unknown) {
      const name = typeof e === "object" && e !== null ? (e as { name?: unknown }).name : undefined;
      const message = e instanceof Error ? e.message : (typeof e === "object" && e !== null ? (e as { message?: unknown }).message : undefined);
      await client.unbind().catch(() => undefined);
      return reply.status(503).send({ ok: false, error: "ldap_unavailable", name: typeof name === "string" ? name : undefined, message: typeof message === "string" ? message : undefined });
    }
  });
};
