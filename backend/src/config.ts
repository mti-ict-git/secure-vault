import dotenv from "dotenv";
import { createWriteStream } from "fs";
import { mkdirSync } from "fs";
import { dirname, join } from "path";

dotenv.config({ path: join(process.cwd(), ".env") });
dotenv.config({ path: join(process.cwd(), "..", ".env") });

const toBool = (v: string | undefined, def = false) =>
  v === undefined ? def : ["true", "1", "yes"].includes(v.toLowerCase());

const toNumber = (v: string | undefined, def: number) => {
  if (v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const toUploadStorage = (v: string | undefined, def: "fs" | "db"): "fs" | "db" => {
  if (!v) return def;
  const s = v.toLowerCase();
  return s === "db" ? "db" : "fs";
};

const logFile = process.env.LOG_FILE || "logs/app.log";
mkdirSync(dirname(join(process.cwd(), logFile)), { recursive: true });
createWriteStream(join(process.cwd(), logFile), { flags: "a" });

export const config = {
  port: toNumber(process.env.BACKEND_PORT || process.env.PORT, 8082),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:8080,localhost")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  rateLimit: {
    windowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 900000),
    max: toNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
  },
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },
  uploads: {
    maxSize: toNumber(process.env.UPLOAD_MAX_SIZE, 10 * 1024 * 1024),
    storage: toUploadStorage(process.env.UPLOAD_STORAGE, "fs"),
    allowed: (process.env.UPLOAD_ALLOWED_TYPES ||
      "image/jpeg,image/png,application/pdf,application/octet-stream,application/json")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },
  db: {
    server: process.env.DB_SERVER || "",
    database: process.env.DB_DATABASE || "",
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    port: toNumber(process.env.DB_PORT, 1433),
    encrypt: toBool(process.env.DB_ENCRYPT, false),
    trustServerCertificate: toBool(
      process.env.DB_TRUST_SERVER_CERTIFICATE,
      true
    ),
  },
  ldap: {
    url: process.env.LDAP_URL || "",
    baseDN: process.env.LDAP_BASE_DN || "",
    bindDN: process.env.LDAP_BIND_DN || "",
    bindPassword: process.env.LDAP_BIND_PASSWORD || "",
    userSearchBase: process.env.LDAP_USER_SEARCH_BASE || "",
    userSearchFilter: process.env.LDAP_USER_SEARCH_FILTER || "",
    groupSearchBase: process.env.LDAP_GROUP_SEARCH_BASE || "",
    domain: process.env.LDAP_DOMAIN || "",
    timeout: toNumber(process.env.LDAP_TIMEOUT, 5000),
    connectTimeout: toNumber(process.env.LDAP_CONNECT_TIMEOUT, 10000),
    tlsRejectUnauthorized: toBool(
      process.env.LDAP_TLS_REJECT_UNAUTHORIZED,
      false
    ),
  },
  openProject: {
    url: process.env.OPENPROJECT_URL || "",
    apiKey: process.env.OPENPROJECT_API_KEY || "",
    apiVersion: process.env.OPENPROJECT_API_VERSION || "v3",
    syncEnabled: toBool(process.env.OPENPROJECT_SYNC_ENABLED, false),
  },
  supabase: {
    projectId: process.env.VITE_SUPABASE_PROJECT_ID || "",
    url: process.env.VITE_SUPABASE_URL || "",
    publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  },
  logFile,
};
