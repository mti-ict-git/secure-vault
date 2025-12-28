import { getPool } from "../db/mssql.js";

export const insertBlob = async (
  id: string,
  vault_id: string,
  blob_type: string,
  content_sha256: string,
  storage_kind: "fs" | "db",
  storage_ref: string,
  size_bytes: number,
  created_by: string | null
) => {
  const pool = await getPool();
  await pool
    .request()
    .input("id", id)
    .input("vault_id", vault_id)
    .input("blob_type", blob_type)
    .input("content_sha256", content_sha256)
    .input("storage_kind", storage_kind)
    .input("storage_ref", storage_ref)
    .input("size_bytes", size_bytes)
    .input("created_by", created_by)
    .query(
      "INSERT INTO dbo.vault_blobs (id,vault_id,blob_type,content_sha256,storage_kind,storage_ref,size_bytes,created_by,created_at) VALUES (@id,@vault_id,@blob_type,@content_sha256,@storage_kind,@storage_ref,@size_bytes,@created_by,SYSUTCDATETIME())"
    );
  return id;
};

export const insertBlobData = async (blob_id: string, data: Buffer) => {
  const pool = await getPool();
  await pool
    .request()
    .input("blob_id", blob_id)
    .input("data", data)
    .query(
      "MERGE dbo.vault_blob_data AS t USING (SELECT @blob_id AS blob_id, @data AS data) AS s ON t.blob_id=s.blob_id WHEN MATCHED THEN UPDATE SET data=s.data, updated_at=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT (blob_id,data,created_at,updated_at) VALUES (s.blob_id,s.data,SYSUTCDATETIME(),SYSUTCDATETIME());"
    );
};

export const getBlobData = async (blob_id: string): Promise<Buffer | null> => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("blob_id", blob_id)
    .query("SELECT data FROM dbo.vault_blob_data WHERE blob_id=@blob_id");
  const row = r.recordset[0] as { data?: Buffer } | undefined;
  return row?.data ?? null;
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
