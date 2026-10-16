export interface StorageMetadata {
  size: number;
  contentType?: string;
  lastModified?: Date;
  etag?: string;
}

export interface UploadUrlResult {
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
}

export interface ReadUrlResult {
  readUrl: string;
}

export interface StorageService {
  /**
   * Generate a short-lived cryptographic signed URL allowing upload of a specific object
   */
  generateUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number
  ): Promise<UploadUrlResult>;

  /**
   * Generate a short-lived cryptographic signed URL allowing read of a specific object
   */
  generateSignedReadUrl(
    key: string,
    expiresInSeconds: number
  ): Promise<ReadUrlResult>;

  /**
   * Check whether an object exists in storage
   */
  objectExists(key: string): Promise<boolean>;

  /**
   * Retrieve metadata of an object in storage
   */
  getObjectMetadata(key: string): Promise<StorageMetadata | null>;

  /**
   * Retrieve full object content buffer from storage
   */
  getObject(key: string): Promise<{ buffer: Buffer; contentType: string; size: number }>;

  /**
   * Put object directly into storage
   */
  putObject(key: string, buffer: Buffer, contentType: string): Promise<void>;

  /**
   * Delete an object from storage
   */
  deleteObject(key: string): Promise<void>;
}
