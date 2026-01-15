import dotenv from "dotenv";
import { join } from "path";
import { getPool } from "../src/db/mssql.js";

dotenv.config({ path: join(process.cwd(), ".env") });
dotenv.config({ path: join(process.cwd(), "..", ".env") });

const run = async () => {
  const email = process.env.ADMIN_EMAIL || "";
  const dn = process.env.ADMIN_DN || "";
  if (!email && !dn) {
    console.error("Provide ADMIN_EMAIL or ADMIN_DN env");
    process.exit(1);
  }
  const pool = await getPool();
  const r = await pool
    .request()
    .input("email", email || null)
    .input("dn", dn || null)
    .query("UPDATE dbo.users SET role='admin' WHERE (email=@email AND @email IS NOT NULL) OR (ldap_dn=@dn AND @dn IS NOT NULL)");
  console.log({ rowsAffected: r.rowsAffected });
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
