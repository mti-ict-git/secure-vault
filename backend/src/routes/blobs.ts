import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import type { Multipart, MultipartFile } from "@fastify/multipart";
import type { FastifyRequest } from "fastify";
import { insertBlob, listBlobs, getBlob, getBlobData } from "../repo/blobs.js";
import { writeAudit } from "../repo/audit.js";
import { config } from "../config.js";
import { createReadStream } from "fs";
import { DatabaseAdapter, FileSystemAdapter } from "../storage/adapter.js";
import { publishSyncEvent, uid } from "../state/store.js";
import { commitKeyRotation, getVault, getVaultAccessForUser } from "../repo/vaults.js";
import { listSharesForVault } from "../repo/shares.js";
import { Readable } from "stream";
import { notifyBlocked, notifyKeyRotated, notifyVaultUpdated } from "../notify.js";

export const blobRoutes = async (app: FastifyInstance) => {
  await app.register(multipart, {
    limits: {
      fileSize: config.uploads.maxSize,
    },
  });
  app.post(
    "/:id/blobs",
    { config: { rateLimit: false } },
    async (req, reply) => {
    type Params = { id: string };
    type Meta = {
      blob_type?: "snapshot" | "delta" | "attachment" | "kdbx";
      content_sha256?: string;
      size_bytes?: number;
      created_by?: string;
      key_version?: number;
    };
    const vaultId = (req.params as Params).id;
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const access = await getVaultAccessForUser(vaultId, userId);
    if (!access) return reply.status(403).send({ error: "forbidden" });
    if (access.permissions !== "write") return reply.status(403).send({ error: "forbidden" });
    const targetVault = (await getVault(vaultId)) as
      | { kind?: string; purpose?: string; owner_user_id?: string | null; key_version?: number }
      | null;
    if (!targetVault) return reply.status(404).send({ error: "not_found" });
    if (
      targetVault.kind === "personal" &&
      targetVault.purpose !== "transfer" &&
      String(targetVault.owner_user_id).toLowerCase() !== userId.toLowerCase()
    ) {
      // A primary personal vault is written only by its owner, whatever the share table says.
      await writeAudit(userId, "blob_upload_blocked", "vault", vaultId, { reason: "not_owner_of_personal_vault" });
      await notifyBlocked(vaultId, userId, "write");
      return reply.status(403).send({ error: "personal_vault_owner_only" });
    }
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
    const currentKeyVersion = Number(targetVault.key_version ?? 1);
    if (currentKeyVersion > 1 && Number(meta.key_version) !== currentKeyVersion) {
      // Encrypted with a rotated-out key (or by an outdated client): refuse, the client must refresh.
      filePart.file.resume();
      return reply.status(409).send({ error: "stale_vault_key", key_version: currentKeyVersion });
    }

    const effectiveBlobType = meta.blob_type || "snapshot";
    if (
      config.uploads.allowed.length &&
      !config.uploads.allowed.includes("*") &&
      !config.uploads.allowed.includes("*/*")
    ) {
      const skipMimeCheck =
        effectiveBlobType === "snapshot" ||
        effectiveBlobType === "delta" ||
        effectiveBlobType === "kdbx" ||
        effectiveBlobType === "attachment";

      if (!skipMimeCheck) {
        const mt = (filePart.mimetype || "")
          .split(";")[0]
          ?.trim()
          .toLowerCase();
        if (!config.uploads.allowed.includes(mt)) {
          return reply.status(415).send({ error: "unsupported_type" });
        }
      }
    }
    const blobId = uid();
    const storage = config.uploads.storage === "db" ? new DatabaseAdapter() : new FileSystemAdapter();
    const storageKind = config.uploads.storage;
    const dest = await storage.put(vaultId, blobId, filePart.file);
    const id = await insertBlob(
      blobId,
      vaultId,
      effectiveBlobType,
      meta.content_sha256 || "",
      storageKind,
      dest,
      meta.size_bytes || 0,
      userId
    );
    await writeAudit(userId, "blob_upload", "vault", vaultId, { blob_id: id, blob_type: effectiveBlobType });
    publishSyncEvent({ t: Date.now(), type: "blob_upload", vault_id: vaultId, actor_user_id: userId });
    await notifyVaultUpdated(vaultId, userId);
    return reply.status(201).send({ id });
    }
  );
  app.get("/:id/blobs", async (req, reply) => {
    type ListParams = { id: string };
    const vaultId = (req.params as ListParams).id;
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const access = await getVaultAccessForUser(vaultId, userId);
    if (!access) return reply.status(403).send({ error: "forbidden" });
    const items = await listBlobs(vaultId);
    return reply.send({ items });
  });
  app.get("/:id/blobs/:blobId", async (req, reply) => {
    type GetParams = { id: string; blobId: string };
    const vaultId = (req.params as GetParams).id;
    const blobId = (req.params as GetParams).blobId;
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const blob = await getBlob(blobId);
    if (!blob) return reply.status(404).send({ error: "not_found" });
    const blobVaultId = (blob as { vault_id?: string | null }).vault_id;
    if (!blobVaultId || blobVaultId !== vaultId) {
      return reply.status(404).send({ error: "not_found" });
    }
    const access = await getVaultAccessForUser(blobVaultId, userId);
    if (!access) return reply.status(403).send({ error: "forbidden" });
    reply.header("Content-Type", "application/octet-stream");
    const storageRef = (blob as { storage_ref?: string | null }).storage_ref;
    const storageKind = (blob as { storage_kind?: string | null }).storage_kind;
    if (storageKind === "db" || (storageRef || "").startsWith("db:")) {
      const data = await getBlobData(blobId);
      if (!data) return reply.status(404).send({ error: "not_found" });
      return reply.send(data);
    }
    if (!storageRef) return reply.status(404).send({ error: "not_found" });
    const rs = createReadStream(storageRef);
    return reply.send(rs);
  });

  // Owner re-keys a vault: new snapshot + new wrapped keys for the owner and every
  // remaining share, committed together. Used after revoking a share.
  app.post("/:id/rotate-key", { config: { rateLimit: false } }, async (req, reply) => {
    const vaultId = (req.params as { id: string }).id;
    const userId = req.user?.id;
    if (!userId) return reply.status(401).send({ error: "unauthorized" });
    const vault = (await getVault(vaultId)) as
      | { kind?: string; owner_user_id?: string | null; key_version?: number }
      | null;
    if (!vault) return reply.status(404).send({ error: "not_found" });
    if (vault.kind !== "personal" || String(vault.owner_user_id).toLowerCase() !== userId.toLowerCase()) {
      return reply.status(403).send({ error: "forbidden" });
    }
    type RotateMeta = {
      expected_key_version?: number;
      vault_key_wrapped?: string;
      shares?: { share_id?: string; wrapped_key?: string }[];
      content_sha256?: string;
      size_bytes?: number;
    };
    const requestWithParts = req as FastifyRequest & { parts: () => AsyncIterableIterator<Multipart> };
    let meta: RotateMeta = {};
    let fileBuf: Buffer | null = null;
    for await (const part of requestWithParts.parts()) {
      if (part.type === "file") {
        const chunks: Buffer[] = [];
        for await (const c of (part as MultipartFile).file) chunks.push(c as Buffer);
        fileBuf = Buffer.concat(chunks);
      } else if (part.type === "field" && part.fieldname === "meta") {
        try {
          meta = JSON.parse(String(part.value || "{}"));
        } catch {
          meta = {};
        }
      }
    }
    if (!fileBuf) return reply.status(400).send({ error: "no_file" });
    if (typeof meta.vault_key_wrapped !== "string" || meta.vault_key_wrapped.length < 16) {
      return reply.status(400).send({ error: "vault_key_wrapped_required" });
    }
    const shares = (meta.shares || []).filter(
      (s): s is { share_id: string; wrapped_key: string } =>
        typeof s.share_id === "string" && typeof s.wrapped_key === "string" && s.wrapped_key.length >= 16
    );
    // Every current share must be re-wrapped; otherwise someone would be left on the old key.
    const current = await listSharesForVault(vaultId);
    const sent = new Set(shares.map((s) => s.share_id.toLowerCase()));
    if (current.length !== shares.length || current.some((s) => !sent.has(String(s.id).toLowerCase()))) {
      return reply.status(409).send({ error: "shares_changed" });
    }
    const blobId = uid();
    const storage = config.uploads.storage === "db" ? new DatabaseAdapter() : new FileSystemAdapter();
    const dest = await storage.put(vaultId, blobId, Readable.from(fileBuf));
    const result = await commitKeyRotation({
      vault_id: vaultId,
      expected_key_version: Number(meta.expected_key_version ?? vault.key_version ?? 1),
      vault_key_wrapped: meta.vault_key_wrapped,
      shares,
      blob: {
        id: blobId,
        content_sha256: meta.content_sha256 || "",
        storage_kind: config.uploads.storage,
        storage_ref: dest,
        size_bytes: fileBuf.length,
        created_by: userId,
      },
    });
    if (!result.ok) return reply.status(409).send({ error: result.error });
    await writeAudit(userId, "vault_key_rotate", "vault", vaultId, {
      key_version: result.key_version,
      remaining_shares: shares.length,
    });
    publishSyncEvent({ t: Date.now(), type: "blob_upload", vault_id: vaultId, actor_user_id: userId });
    await notifyKeyRotated(vaultId, userId);
    return reply.send({ ok: true, key_version: result.key_version });
  });
};

