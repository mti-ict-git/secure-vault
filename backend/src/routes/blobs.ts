import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { store, uid } from "../state/store.js";
import { config } from "../config.js";
import { createReadStream, createWriteStream, mkdirSync } from "fs";
import { join } from "path";

export const blobRoutes = async (app: FastifyInstance) => {
  await app.register(multipart, {
    limits: {
      fileSize: config.uploads.maxSize,
    },
  });
  app.post("/:id/blobs", async (req, reply) => {
    const vaultId = (req.params as any).id as string;
    const parts = (req as any).parts();
    let meta: any = {};
    let filePart: any = null;
    for await (const part of parts) {
      if (part.type === "file") {
        filePart = part;
      } else if (part.type === "field" && part.fieldname === "meta") {
        const v = part.value;
        const s = typeof v === "string" ? v : String(v);
        try {
          meta = JSON.parse(s || "{}");
        } catch {
          meta = {};
        }
      }
    }
    if (!filePart) return reply.status(400).send({ error: "no_file" });
    if (
      config.uploads.allowed.length &&
      !config.uploads.allowed.includes(filePart.mimetype)
    ) {
      return reply.status(415).send({ error: "unsupported_type" });
    }
    const id = uid();
    const dir = join(process.cwd(), "uploads", vaultId);
    mkdirSync(dir, { recursive: true });
    const dest = join(dir, id);
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(dest);
      filePart.file.pipe(ws);
      ws.on("finish", () => resolve());
      ws.on("error", reject);
    });
    store.blobs.set(id, {
      id,
      vault_id: vaultId,
      blob_type: meta.blob_type || "snapshot",
      content_sha256: meta.content_sha256 || "",
      storage_ref: dest,
      size_bytes: meta.size_bytes || 0,
      created_by: meta.created_by || "",
      created_at: Date.now(),
    });
    return reply.status(201).send({ id });
  });
  app.get("/:id/blobs", async (req, reply) => {
    const vaultId = (req.params as any).id as string;
    const items = Array.from(store.blobs.values()).filter(
      (b) => b.vault_id === vaultId
    );
    return reply.send({ items });
  });
  app.get("/:id/blobs/:blobId", async (req, reply) => {
    const blobId = (req.params as any).blobId as string;
    const blob = store.blobs.get(blobId);
    if (!blob) return reply.status(404).send({ error: "not_found" });
    reply.header("Content-Type", "application/octet-stream");
    const rs = createReadStream(blob.storage_ref);
    return reply.send(rs);
  });
};
