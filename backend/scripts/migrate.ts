import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getPool } from "../src/db/mssql.js";

const dir = join(process.cwd(), "migrations");

const run = async () => {
  const pool = await getPool();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    console.log(`Applying ${f}...`);
    await pool.request().batch(sql);
    console.log(`Applied ${f}`);
  }
  console.log("All migrations applied.");
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

