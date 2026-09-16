import { StorageProvider } from "./storage.interface.js";
import { LocalStorageProvider } from "./local.storage.js";
import { S3StorageProvider } from "./s3.storage.js";
import { env } from "../config/index.js";

export * from "./storage.interface.js";
export * from "./local.storage.js";
export * from "./s3.storage.js";
export * from "./storage-path.util.js";

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (storageInstance) return storageInstance;

  if (env.STORAGE_PROVIDER === "b2") {
    storageInstance = new S3StorageProvider({
      bucket: env.B2_BUCKET_NAME || env.S3_BUCKET || "resumeai-storage-2026",
      region: env.B2_REGION || env.S3_REGION || "us-east-005",
      endpoint:
        env.B2_ENDPOINT ||
        env.S3_ENDPOINT ||
        "https://s3.us-east-005.backblazeb2.com",
      accessKeyId: env.B2_KEY_ID || env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.B2_APPLICATION_KEY || env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: true,
    });
  } else if (env.STORAGE_PROVIDER === "s3" && env.S3_BUCKET) {
    storageInstance = new S3StorageProvider({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
    });
  } else {
    storageInstance = new LocalStorageProvider(env.LOCAL_STORAGE_DIR);
  }

  return storageInstance;
}

export function resetStorageProviderForTesting(): void {
  storageInstance = null;
}

