import type { FastifyInstance } from "fastify";
import { keysRoutes } from "./routes/keys.js";
import { authRoutes } from "./routes/auth.js";
import { vaultRoutes } from "./routes/vaults.js";
import { blobRoutes } from "./routes/blobs.js";
import { teamRoutes } from "./routes/teams.js";
import { shareRoutes } from "./routes/shares.js";
import { syncRoutes } from "./routes/sync.js";
import { meRoutes } from "./routes/me.js";
import { adminRoutes } from "./routes/admin.js";
import { healthRoutes } from "./routes/health.js";

export const registerRoutes = async (app: FastifyInstance) => {
  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(keysRoutes, { prefix: "/keys" });
  await app.register(vaultRoutes, { prefix: "/vaults" });
  await app.register(blobRoutes, { prefix: "/vaults" });
  await app.register(teamRoutes, { prefix: "/teams" });
  await app.register(shareRoutes, { prefix: "/shares" });
  await app.register(syncRoutes, { prefix: "/sync" });
  await app.register(meRoutes, { prefix: "" });
  await app.register(adminRoutes, { prefix: "/admin" });
};
