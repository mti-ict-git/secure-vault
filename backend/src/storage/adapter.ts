import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";

export interface StorageAdapter {
  put(vaultId: string, blobId: string, readable: NodeJS.ReadableStream): Promise<string>;
}

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
