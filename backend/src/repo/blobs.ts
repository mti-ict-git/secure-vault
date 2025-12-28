import { getPool } from "../db/mssql.js";
import { uid } from "../state/store.js";

export const insertBlob = async (
  vault_id: string,
  blob_type: string,
  content_sha256: string,
  storage_ref: string,
  size_bytes: number,
  created_by: string | null
) => {
  const id = uid();
  const pool = await getPool();
  await pool
    .request()
    .input("id", id)
    .input("vault_id", vault_id)
    .input("blob_type", blob_type)
    .input("content_sha256", content_sha256)
    .input("storage_ref", storage_ref)
    .input("size_bytes", size_bytes)
    .input("created_by", created_by)
    .query(
      "INSERT INTO dbo.vault_blobs (id,vault_id,blob_type,content_sha256,storage_ref,size_bytes,created_by,created_at) VALUES (@id,@vault_id,@blob_type,@content_sha256,@storage_ref,@size_bytes,@created_by,SYSUTCDATETIME())"
    );
  return id;
};

export const listBlobs = async (vault_id: string) => {
  const pool = await getPool();
  const r = await pool.request().input("vault_id", vault_id).query("SELECT * FROM dbo.vault_blobs WHERE vault_id=@vault_id ORDER BY created_at DESC");
  return r.recordset;
};

export const getBlob = async (id: string) => {
  const pool = await getPool();
  const r = await pool.request().input("id", id).query("SELECT * FROM dbo.vault_blobs WHERE id=@id");
  return r.recordset[0] || null;
};
