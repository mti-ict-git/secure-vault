import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import type { Multipart, MultipartFile } from "@fastify/multipart";
import type { FastifyRequest } from "fastify";
import { insertBlob, listBlobs, getBlob } from "../repo/blobs.js";
import { writeAudit } from "../repo/audit.js";
import { config } from "../config.js";
import { createReadStream } from "fs";
import { join } from "path";
import { FileSystemAdapter } from "../storage/adapter.js";
import { uid } from "../state/store.js";

export const blobRoutes = async (app: FastifyInstance) => {
  await app.register(multipart, {
    limits: {
      fileSize: config.uploads.maxSize,
    },
  });
  app.post("/:id/blobs", async (req, reply) => {
    type Params = { id: string };
    type Meta = {
      blob_type?: "snapshot" | "delta" | "attachment" | "kdbx";
      content_sha256?: string;
      size_bytes?: number;
      created_by?: string;
    };
    const vaultId = (req.params as Params).id;
    const requestWithParts = req as FastifyRequest & {
      parts: () => AsyncIterableIterator<Multipart>;
    };
    let meta: Meta = {};
    let filePart: MultipartFile | null = null;
    for await (const part of requestWithParts.parts()) {
      if (part.type === "file") {
        filePart = part as MultipartFile;
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
    const storage = new FileSystemAdapter();
    const blobId = uid();
    const dest = await storage.put(vaultId, blobId, filePart.file);
    const id = await insertBlob(
      vaultId,
      meta.blob_type || "snapshot",
      meta.content_sha256 || "",
      dest,
      meta.size_bytes || 0,
      req.user?.id || null
    );
    await writeAudit(req.user?.id || null, "blob_upload", "vault", vaultId, { blob_id: id, blob_type: meta.blob_type || "snapshot" });
    return reply.status(201).send({ id });
  });
  app.get("/:id/blobs", async (req, reply) => {
    type ListParams = { id: string };
    const vaultId = (req.params as ListParams).id;
    const items = await listBlobs(vaultId);
    return reply.send({ items });
  });
  app.get("/:id/blobs/:blobId", async (req, reply) => {
    type GetParams = { id: string; blobId: string };
    const blobId = (req.params as GetParams).blobId;
    const blob = await getBlob(blobId);
    if (!blob) return reply.status(404).send({ error: "not_found" });
    reply.header("Content-Type", "application/octet-stream");
    const rs = createReadStream(blob.storage_ref);
    return reply.send(rs);
  });
};
