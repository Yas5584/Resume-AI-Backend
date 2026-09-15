export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
}

export interface UploadResult {
  key: string;
  url: string;
  sizeBytes: number;
}

export interface StorageProvider {
  uploadFile(
    key: string,
    buffer: Buffer,
    options?: UploadOptions,
  ): Promise<UploadResult>;
  getFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
