import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";
import { insertBlobData } from "../repo/blobs.js";

export interface StorageAdapter {
  put(vaultId: string, blobId: string, readable: NodeJS.ReadableStream): Promise<string>;
}

const streamToBuffer = async (readable: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    readable.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
};

export class FileSystemAdapter implements StorageAdapter {
  baseDir: string;
  constructor(baseDir = join(process.cwd(), "uploads")) {
    this.baseDir = baseDir;
  }
  async put(vaultId: string, blobId: string, readable: NodeJS.ReadableStream): Promise<string> {
    const dir = join(this.baseDir, vaultId);
    mkdirSync(dir, { recursive: true });
    const dest = join(dir, blobId);
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(dest);
      readable.pipe(ws);
      ws.on("finish", () => resolve());
      ws.on("error", reject);
    });
    return dest;
  }
}

export class DatabaseAdapter implements StorageAdapter {
  async put(_vaultId: string, blobId: string, readable: NodeJS.ReadableStream): Promise<string> {
    const buf = await streamToBuffer(readable);
    await insertBlobData(blobId, buf);
    return `db:${blobId}`;
  }
}
