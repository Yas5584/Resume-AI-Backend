import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import {
  StorageMetadata,
  StorageProvider,
  UploadOptions,
  UploadResult,
} from "./storage.interface.js";
import { AppError } from "../errors/index.js";
import { logger } from "../utils/logger.js";

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrlBase?: string;
  forcePathStyle?: boolean;
}

/**
 * Derives the AWS/B2 region from the endpoint URL if not explicitly provided.
 * E.g. https://s3.us-east-005.backblazeb2.com -> us-east-005
 */
function resolveRegionFromEndpoint(endpoint?: string, fallbackRegion = "us-east-1"): string {
  if (!endpoint) return fallbackRegion;
  const match = endpoint.match(/s3\.([a-z0-9\-]+)\.backblazeb2\.com/i);
  if (match && match[1]) {
    return match[1];
  }
  return fallbackRegion;
}

/**
 * Concrete S3 / Backblaze B2 / Cloudflare R2 / MinIO compatible storage provider.
 * Interacts with any S3-compatible object storage privately and securely.
 */
export class S3StorageProvider implements StorageProvider {
  private config: S3Config;
  private client: S3Client;

  constructor(config: S3Config) {
    this.config = config;

    const credentials =
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined;

    const region =
      config.region || resolveRegionFromEndpoint(config.endpoint, "us-east-005");

    const forcePathStyle =
      config.forcePathStyle !== undefined
        ? config.forcePathStyle
        : Boolean(config.endpoint);

    this.client = new S3Client({
      region,
      endpoint: config.endpoint || undefined,
      credentials,
      forcePathStyle,
    });
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    const start = Date.now();
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: buffer,
      ContentType: options?.contentType || "application/octet-stream",
      Metadata: options?.metadata,
    });

    try {
      await this.client.send(command);

      const durationMs = Date.now() - start;
      logger.info("[Storage] Uploaded object successfully", {
        key,
        bucket: this.config.bucket,
        sizeBytes: buffer.length,
        durationMs,
      });

      const baseUrl =
        this.config.publicUrlBase ||
        (this.config.endpoint
          ? `${this.config.endpoint}/${this.config.bucket}`
          : `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com`);

      return {
        key,
        url: `${baseUrl}/${key}`,
        sizeBytes: buffer.length,
      };
    } catch (err: any) {
      logger.error("[Storage] Failed to upload object", {
        key,
        bucket: this.config.bucket,
        errorMessage: err?.message,
      });
      throw AppError.internal("Storage upload failed.");
    }
  }

  async getFile(key: string): Promise<Buffer> {
    const start = Date.now();
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    try {
      const response = await this.client.send(command);
      if (!response.Body) {
        throw AppError.notFound("Storage object is empty");
      }

      let resultBuffer: Buffer;
      if (response.Body instanceof Readable) {
        const chunks: Buffer[] = [];
        for await (const chunk of response.Body) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        resultBuffer = Buffer.concat(chunks);
      } else {
        const byteArray = await (response.Body as any).transformToByteArray();
        resultBuffer = Buffer.from(byteArray);
      }

      logger.info("[Storage] Retrieved object successfully", {
        key,
        bucket: this.config.bucket,
        sizeBytes: resultBuffer.length,
        durationMs: Date.now() - start,
      });

      return resultBuffer;
    } catch (err: any) {
      if (err instanceof AppError) throw err;

      const code = err?.name || err?.Code || err?.code;
      if (
        code === "NoSuchKey" ||
        code === "NotFound" ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        throw AppError.notFound("Storage object");
      }

      logger.error("[Storage] Failed to retrieve object", {
        key,
        bucket: this.config.bucket,
        errorMessage: err?.message,
      });
      throw AppError.internal("Storage retrieval failed.");
    }
  }

  async deleteFile(key: string): Promise<void> {
    const start = Date.now();
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
      logger.info("[Storage] Deleted object successfully", {
        key,
        bucket: this.config.bucket,
        durationMs: Date.now() - start,
      });
    } catch (err: any) {
      const code = err?.name || err?.Code || err?.code;
      if (
        code === "NoSuchKey" ||
        code === "NotFound" ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        // Idempotent: already deleted
        return;
      }
      logger.error("[Storage] Failed to delete object", {
        key,
        bucket: this.config.bucket,
        errorMessage: err?.message,
      });
      throw AppError.internal("Storage deletion failed.");
    }
  }

  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    try {
      const signedUrl = await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });
      logger.info("[Storage] Generated presigned download URL", {
        key,
        bucket: this.config.bucket,
        expiresInSeconds,
      });
      return signedUrl;
    } catch (err: any) {
      logger.error("[Storage] Failed to generate presigned download URL", {
        key,
        bucket: this.config.bucket,
        errorMessage: err?.message,
      });
      throw AppError.internal("Failed to generate download URL.");
    }
  }

  async exists(key: string): Promise<boolean> {
    const command = new HeadObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    try {
      await this.client.send(command);
      return true;
    } catch (err: any) {
      const code = err?.name || err?.Code || err?.code;
      if (
        code === "NotFound" ||
        code === "NoSuchKey" ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      return false;
    }
  }

  async getMetadata(key: string): Promise<StorageMetadata | null> {
    const command = new HeadObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    try {
      const response = await this.client.send(command);
      return {
        contentType: response.ContentType,
        sizeBytes: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (err: any) {
      const code = err?.name || err?.Code || err?.code;
      if (
        code === "NotFound" ||
        code === "NoSuchKey" ||
        err?.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw AppError.internal("Failed to retrieve storage metadata.");
    }
  }
}

