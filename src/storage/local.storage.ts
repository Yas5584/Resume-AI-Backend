import fs from "fs/promises";
import path from "path";
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from "./storage.interface.js";

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir = "./uploads") {
    this.baseDir = path.resolve(baseDir);
  }

  private async ensureDir(filePath: string) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  private resolveSafePath(key: string): string {
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const targetPath = path.resolve(this.baseDir, sanitizedKey);
    if (!targetPath.startsWith(this.baseDir)) {
      throw new Error("Path traversal detected");
    }
    return targetPath;
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    _options?: UploadOptions,
  ): Promise<UploadResult> {
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const targetPath = this.resolveSafePath(sanitizedKey);

    await this.ensureDir(targetPath);
    await fs.writeFile(targetPath, buffer);

    return {
      key: sanitizedKey,
      url: `/uploads/${sanitizedKey}`,
      sizeBytes: buffer.length,
    };
  }

  async getFile(key: string): Promise<Buffer> {
    const targetPath = this.resolveSafePath(key);
    return fs.readFile(targetPath);
  }

  async deleteFile(key: string): Promise<void> {
    const targetPath = this.resolveSafePath(key);
    try {
      await fs.unlink(targetPath);
    } catch {
      // Ignore if already absent
    }
  }

  async getSignedDownloadUrl(
    key: string,
    _expiresInSeconds = 900,
  ): Promise<string> {
    return `/uploads/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const targetPath = this.resolveSafePath(key);
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string) {
    try {
      const targetPath = this.resolveSafePath(key);
      const stat = await fs.stat(targetPath);
      return {
        sizeBytes: stat.size,
        lastModified: stat.mtime,
      };
    } catch {
      return null;
    }
  }
}
