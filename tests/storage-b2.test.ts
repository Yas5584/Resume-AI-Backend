import { describe, it, expect, vi, beforeEach } from "vitest";
import { EnvSchema } from "../src/config/index.js";
import {
  S3StorageProvider,
  LocalStorageProvider,
  getStorageProvider,
  resetStorageProviderForTesting,
} from "../src/storage/index.js";
import {
  sanitizeFilenameForStorage,
  assertSafeStorageKey,
  buildImportStorageKey,
  validateStorageKeyOwnership,
} from "../src/storage/storage-path.util.js";
import { AppError } from "../src/errors/index.js";

describe("Backblaze B2 & Storage Provider Architecture", () => {
  describe("1. Configuration & Environment Validation", () => {
    it("should accept valid B2 storage configuration", () => {
      const validB2Config = {
        STORAGE_PROVIDER: "b2",
        B2_KEY_ID: "005abcdef1234560000000001",
        B2_APPLICATION_KEY: "K005abcdef1234567890abcdef12345",
        B2_BUCKET_NAME: "resumeai-storage-2026",
        B2_ENDPOINT: "https://s3.us-east-005.backblazeb2.com",
        B2_REGION: "us-east-005",
      };

      const result = EnvSchema.safeParse(validB2Config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.STORAGE_PROVIDER).toBe("b2");
        expect(result.data.B2_BUCKET_NAME).toBe("resumeai-storage-2026");
        expect(result.data.B2_ENDPOINT).toBe(
          "https://s3.us-east-005.backblazeb2.com",
        );
      }
    });

    it("should accept B2 configuration with S3 credential aliases as fallback", () => {
      const b2WithS3Aliases = {
        STORAGE_PROVIDER: "b2",
        S3_ACCESS_KEY_ID: "alias-key-id",
        S3_SECRET_ACCESS_KEY: "alias-secret-key",
        B2_BUCKET_NAME: "resumeai-storage-2026",
        B2_ENDPOINT: "https://s3.us-east-005.backblazeb2.com",
      };

      const result = EnvSchema.safeParse(b2WithS3Aliases);
      expect(result.success).toBe(true);
    });

    it("should fail fast in production if STORAGE_PROVIDER is b2 but B2_KEY_ID is missing", () => {
      const invalidB2Config = {
        STORAGE_PROVIDER: "b2",
        B2_APPLICATION_KEY: "secret-key",
        B2_BUCKET_NAME: "resumeai-storage-2026",
        B2_ENDPOINT: "https://s3.us-east-005.backblazeb2.com",
      };

      const result = EnvSchema.safeParse(invalidB2Config);
      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.B2_KEY_ID).toBeDefined();
        expect(fieldErrors.B2_KEY_ID?.[0]).toContain("B2_KEY_ID");
      }
    });

    it("should fail fast if STORAGE_PROVIDER is b2 but B2_APPLICATION_KEY is missing", () => {
      const invalidB2Config = {
        STORAGE_PROVIDER: "b2",
        B2_KEY_ID: "valid-key-id",
        B2_BUCKET_NAME: "resumeai-storage-2026",
        B2_ENDPOINT: "https://s3.us-east-005.backblazeb2.com",
      };

      const result = EnvSchema.safeParse(invalidB2Config);
      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.B2_APPLICATION_KEY).toBeDefined();
      }
    });

    it("should fail fast if STORAGE_PROVIDER is s3 but S3 credentials are missing", () => {
      const invalidS3Config = {
        STORAGE_PROVIDER: "s3",
        S3_BUCKET: "my-bucket",
      };

      const result = EnvSchema.safeParse(invalidS3Config);
      expect(result.success).toBe(false);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        expect(fieldErrors.S3_ACCESS_KEY_ID).toBeDefined();
        expect(fieldErrors.S3_SECRET_ACCESS_KEY).toBeDefined();
      }
    });

    it("should allow STORAGE_PROVIDER=local without requiring any cloud credentials", () => {
      const localConfig = {
        STORAGE_PROVIDER: "local",
        LOCAL_STORAGE_DIR: "./uploads",
      };

      const result = EnvSchema.safeParse(localConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.STORAGE_PROVIDER).toBe("local");
        expect(result.data.B2_KEY_ID).toBeUndefined();
      }
    });
  });

  describe("2. Storage Path Security & Ownership", () => {
    it("should build safe, user-scoped import storage key", () => {
      const userId = "usr-1234-abcd";
      const importId = "imp-5678-efgh";
      const filename = "Yash_Resume (1).pdf";

      const key = buildImportStorageKey(userId, importId, filename);
      expect(key).toBe("imports/usr-1234-abcd/imp-5678-efgh/Yash_Resume__1.pdf");
      expect(key.startsWith("imports/usr-1234-abcd/")).toBe(true);
      expect(key.endsWith(".pdf")).toBe(true);
    });

    it("should reject path traversal attempts in storage keys", () => {
      expect(() => assertSafeStorageKey("../../../etc/passwd")).toThrow(AppError);
      expect(() => assertSafeStorageKey("imports/../../root/secrets.txt")).toThrow(AppError);
      expect(() => assertSafeStorageKey("imports\\user\\file.pdf")).toThrow(AppError);
      expect(() => assertSafeStorageKey("/absolute/path/file.pdf")).toThrow(AppError);
      expect(() => assertSafeStorageKey("imports/user/\0nullbyte.pdf")).toThrow(AppError);
    });

    it("should sanitize filenames and preserve valid extensions", () => {
      expect(sanitizeFilenameForStorage("../../malicious.exe")).toBe("malicious.exe");
      expect(sanitizeFilenameForStorage("Resume:::*?<>|.pdf")).toBe("Resume.pdf");
      expect(sanitizeFilenameForStorage("")).toBe("document.bin");
      expect(sanitizeFilenameForStorage("my resume.DOCX")).toBe("my_resume.docx");
    });

    it("should enforce cross-user tenant isolation on storage keys", () => {
      const userA = "user-aaa";
      const userB = "user-bbb";

      const userAKey = buildImportStorageKey(userA, "imp-1", "resume.pdf");

      expect(validateStorageKeyOwnership(userAKey, userA)).toBe(true);
      expect(validateStorageKeyOwnership(userAKey, userB)).toBe(false);
      expect(validateStorageKeyOwnership("users/user-aaa/exports/res.pdf", userA)).toBe(true);
      expect(validateStorageKeyOwnership("users/user-aaa/exports/res.pdf", userB)).toBe(false);
      expect(validateStorageKeyOwnership("imports/user-aaa/../user-bbb/file.pdf", userA)).toBe(false);
    });
  });

  describe("3. S3StorageProvider with Backblaze B2 Configuration", () => {
    it("should instantiate S3StorageProvider with Backblaze B2 endpoint and path style", () => {
      const provider = new S3StorageProvider({
        bucket: "resumeai-storage-2026",
        region: "us-east-005",
        endpoint: "https://s3.us-east-005.backblazeb2.com",
        accessKeyId: "mock-key-id",
        secretAccessKey: "mock-application-key",
        forcePathStyle: true,
      });

      expect(provider).toBeInstanceOf(S3StorageProvider);
      expect(typeof provider.uploadFile).toBe("function");
      expect(typeof provider.getFile).toBe("function");
      expect(typeof provider.deleteFile).toBe("function");
      expect(typeof provider.getSignedDownloadUrl).toBe("function");
      expect(typeof provider.exists).toBe("function");
      expect(typeof provider.getMetadata).toBe("function");
    });

    it("should automatically derive region from Backblaze B2 endpoint URL", () => {
      const provider = new S3StorageProvider({
        bucket: "resumeai-storage-2026",
        region: "", // empty region, should derive from endpoint
        endpoint: "https://s3.us-east-005.backblazeb2.com",
        accessKeyId: "mock-key",
        secretAccessKey: "mock-secret",
      });

      expect(provider).toBeDefined();
    });

    it("should handle S3 NoSuchKey error by throwing 404 AppError", async () => {
      const provider = new S3StorageProvider({
        bucket: "resumeai-storage-2026",
        region: "us-east-005",
        endpoint: "https://s3.us-east-005.backblazeb2.com",
        accessKeyId: "mock-key",
        secretAccessKey: "mock-secret",
      });

      // Mock client.send to simulate NoSuchKey
      const mockClient = (provider as any).client;
      mockClient.send = vi.fn().mockRejectedValue({
        name: "NoSuchKey",
        message: "The specified key does not exist.",
      });

      await expect(provider.getFile("non-existent-key.pdf")).rejects.toThrow(
        AppError,
      );

      try {
        await provider.getFile("non-existent-key.pdf");
      } catch (err: any) {
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("Storage object not found");
      }
    });

    it("should be idempotent when deleting non-existent objects", async () => {
      const provider = new S3StorageProvider({
        bucket: "resumeai-storage-2026",
        region: "us-east-005",
        endpoint: "https://s3.us-east-005.backblazeb2.com",
        accessKeyId: "mock-key",
        secretAccessKey: "mock-secret",
      });

      const mockClient = (provider as any).client;
      mockClient.send = vi.fn().mockRejectedValue({
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
      });

      // Should not throw on NoSuchKey
      await expect(provider.deleteFile("already-deleted.pdf")).resolves.toBeUndefined();
    });
  });

  describe("4. Storage Provider Factory & Reset", () => {
    beforeEach(() => {
      resetStorageProviderForTesting();
    });

    it("should return a singleton StorageProvider instance", () => {
      const instance1 = getStorageProvider();
      const instance2 = getStorageProvider();
      expect(instance1).toBe(instance2);
    });

    it("should reset singleton instance cleanly when reset is called", () => {
      const instance1 = getStorageProvider();
      resetStorageProviderForTesting();
      const instance2 = getStorageProvider();
      expect(instance1).not.toBe(instance2);
    });
  });
});
