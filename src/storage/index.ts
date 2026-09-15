import { StorageProvider } from "./storage.interface.js";
import { LocalStorageProvider } from "./local.storage.js";
import { S3StorageProvider } from "./s3.storage.js";
import { env } from "../config/index.js";

export * from "./storage.interface.js";
export * from "./local.storage.js";
export * from "./s3.storage.js";

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (storageInstance) return storageInstance;

  if (env.STORAGE_PROVIDER === "s3" && env.S3_BUCKET) {
    storageInstance = new S3StorageProvider({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    });
  } else {
    storageInstance = new LocalStorageProvider(env.LOCAL_STORAGE_DIR);
  }

  return storageInstance;
}
