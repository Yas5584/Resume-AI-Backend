import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from "./storage.interface.js";

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrlBase?: string;
}

/**
 * Concrete S3 / Cloudflare R2 / MinIO compatible storage provider.
 * Supports AWS S3, Cloudflare R2, and self-hosted S3-compatible endpoints.
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

    this.client = new S3Client({
      region: config.region || "us-east-1",
      endpoint: config.endpoint || undefined,
      credentials,
      forcePathStyle: Boolean(config.endpoint), // Required for MinIO and some R2 custom domains
    });
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: buffer,
      ContentType: options?.contentType || "application/octet-stream",
      Metadata: options?.metadata,
    });

    await this.client.send(command);

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
  }

  async getFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`S3 object body is empty for key: ${key}`);
    }

    if (response.Body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    // Node.js Web Stream fallback
    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
