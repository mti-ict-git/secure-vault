import { existsSync, readFileSync, unlinkSync } from "fs";
import { getPool } from "../src/db/mssql.js";
import { insertBlobData } from "../src/repo/blobs.js";

type BlobRow = {
  id: string;
  vault_id: string;
  storage_ref: string;
  storage_kind: string | null;
};

const parseArgs = (argv: string[]) => {
  const flags = new Set(argv.slice(2));
  return {
    deleteFiles: flags.has("--delete-files"),
    dryRun: flags.has("--dry-run"),
    report: flags.has("--report"),
  };
};

const run = async () => {
  const { deleteFiles, dryRun, report } = parseArgs(process.argv);
  const pool = await getPool();

  if (report) {
    const counts = await pool.request().query(
      "SELECT COUNT(1) AS total_count, SUM(CASE WHEN storage_kind='db' OR storage_ref LIKE 'db:%' THEN 1 ELSE 0 END) AS db_count, SUM(CASE WHEN (storage_kind IS NULL OR storage_kind<>'db') AND storage_ref NOT LIKE 'db:%' THEN 1 ELSE 0 END) AS fs_count FROM dbo.vault_blobs"
    );
    const examples = await pool.request().query(
      "SELECT TOP 10 id,vault_id,storage_ref,storage_kind,created_at FROM dbo.vault_blobs WHERE (storage_kind IS NULL OR storage_kind<>'db') AND storage_ref NOT LIKE 'db:%' ORDER BY created_at ASC"
    );

    type CountsRow = {
      total_count: number;
      db_count: number;
      fs_count: number;
    };

    const row = counts.recordset[0] as CountsRow | undefined;
    console.log(
      JSON.stringify(
        {
          total: row?.total_count ?? 0,
          db: row?.db_count ?? 0,
          fs: row?.fs_count ?? 0,
          fsExamples: examples.recordset,
        },
        null,
        2
      )
    );
    return;
  }

  const r = await pool
    .request()
    .query(
      "SELECT id,vault_id,storage_ref,storage_kind FROM dbo.vault_blobs WHERE (storage_kind IS NULL OR storage_kind <> 'db') AND storage_ref IS NOT NULL AND storage_ref NOT LIKE 'db:%' ORDER BY created_at ASC"
    );

  const rows = r.recordset as BlobRow[];
  let migrated = 0;
  let missingFiles = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.storage_ref) {
      skipped += 1;
      continue;
    }
    if (!existsSync(row.storage_ref)) {
      missingFiles += 1;
      continue;
    }

    const buf = readFileSync(row.storage_ref);
    if (!dryRun) {
      await insertBlobData(row.id, buf);
      await pool
        .request()
        .input("id", row.id)
        .query("UPDATE dbo.vault_blobs SET storage_kind='db' WHERE id=@id");
    }
    migrated += 1;

    if (deleteFiles && !dryRun) {
      try {
        unlinkSync(row.storage_ref);
      } catch (e: unknown) {
        void e;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        totalCandidates: rows.length,
        migrated,
        missingFiles,
        skipped,
        dryRun,
        deleteFiles,
      },
      null,
      2
    )
  );
};

run().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
