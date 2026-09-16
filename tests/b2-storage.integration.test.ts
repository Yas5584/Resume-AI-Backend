import { describe, it, expect } from "vitest";
import { S3StorageProvider } from "../src/storage/s3.storage.js";
import { randomUUID } from "node:crypto";

const isIntegrationTestActive =
  process.env.B2_INTEGRATION_TEST === "true" &&
  Boolean(process.env.B2_KEY_ID || process.env.S3_ACCESS_KEY_ID) &&
  Boolean(process.env.B2_APPLICATION_KEY || process.env.S3_SECRET_ACCESS_KEY);

describe.runIf(isIntegrationTestActive)(
  "Backblaze B2 Live Integration Test (Production Bucket: resumeai-storage-2026)",
  () => {
    const keyId =
      process.env.B2_KEY_ID || process.env.S3_ACCESS_KEY_ID || "";
    const appKey =
      process.env.B2_APPLICATION_KEY ||
      process.env.S3_SECRET_ACCESS_KEY ||
      "";
    const bucket =
      process.env.B2_BUCKET_NAME ||
      process.env.S3_BUCKET ||
      "resumeai-storage-2026";
    const endpoint =
      process.env.B2_ENDPOINT ||
      process.env.S3_ENDPOINT ||
      "https://s3.us-east-005.backblazeb2.com";
    const region =
      process.env.B2_REGION || process.env.S3_REGION || "us-east-005";

    const provider = new S3StorageProvider({
      bucket,
      endpoint,
      region,
      accessKeyId: keyId,
      secretAccessKey: appKey,
      forcePathStyle: true,
    });

    const testId = randomUUID();
    const testKey = `integration-tests/${testId}/test.txt`;
    const testContent = Buffer.from(
      `ResumeAI B2 Storage Integration Test Verification at ${new Date().toISOString()} [id=${testId}]`,
      "utf-8",
    );

    it("should execute full end-to-end B2 lifecycle: upload -> get -> verify -> delete", async () => {
      try {
        // 1. Upload test buffer
        const uploadResult = await provider.uploadFile(testKey, testContent, {
          contentType: "text/plain",
          metadata: { testId, framework: "ResumeAI" },
        });

        expect(uploadResult.key).toBe(testKey);
        expect(uploadResult.sizeBytes).toBe(testContent.length);

        // 2. Check exists
        if (provider.exists) {
          const exists = await provider.exists(testKey);
          expect(exists).toBe(true);
        }

        // 3. Download and verify content
        const downloadedBuffer = await provider.getFile(testKey);
        expect(downloadedBuffer.equals(testContent)).toBe(true);
        expect(downloadedBuffer.toString("utf-8")).toBe(
          testContent.toString("utf-8"),
        );

        // 4. Generate presigned download URL
        const signedUrl = await provider.getSignedDownloadUrl(testKey, 300);
        expect(typeof signedUrl).toBe("string");
        expect(signedUrl).toContain("X-Amz-Signature=");
        expect(signedUrl).toContain(bucket);

        // 5. Check metadata
        if (provider.getMetadata) {
          const meta = await provider.getMetadata(testKey);
          expect(meta).not.toBeNull();
          expect(meta?.sizeBytes).toBe(testContent.length);
        }
      } finally {
        // 6. Guaranteed cleanup - delete test object
        try {
          await provider.deleteFile(testKey);
        } catch {
          // Ignore delete errors in finally
        }

        // 7. Verify object is deleted
        if (provider.exists) {
          const existsAfterDelete = await provider.exists(testKey);
          expect(existsAfterDelete).toBe(false);
        }
      }
    });
  },
);
