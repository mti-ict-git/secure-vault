import sql from "mssql";
import { config } from "../config.js";

let pool: sql.ConnectionPool | null = null;

export const getPool = async () => {
  if (pool && pool.connected) return pool;
  const cfg: sql.config = {
    server: config.db.server,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    port: config.db.port,
    options: {
      encrypt: config.db.encrypt,
      trustServerCertificate: config.db.trustServerCertificate,
    },
  };
  pool = await sql.connect(cfg);
  return pool;
};

export const pingDb = async () => {
  const p = await getPool();
  const r = await p.request().query("SELECT 1 as ok");
  return r.recordset[0]?.ok === 1;
};
