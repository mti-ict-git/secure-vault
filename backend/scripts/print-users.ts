import dotenv from "dotenv";
import { join } from "path";
import { getPool } from "../src/db/mssql.js";

dotenv.config({ path: join(process.cwd(), ".env") });
dotenv.config({ path: join(process.cwd(), "..", ".env") });

const run = async () => {
  const pool = await getPool();
  const r = await pool
    .request()
    .query(
      "SELECT id, email, display_name, ldap_dn, role, created_at, last_login_at FROM dbo.users ORDER BY last_login_at DESC"
    );
  console.log(JSON.stringify({ users: r.recordset }, null, 2));
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
