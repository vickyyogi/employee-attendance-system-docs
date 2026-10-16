import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { env } from '../../config/env';
import type {
  StorageService,
  StorageMetadata,
  UploadUrlResult,
  ReadUrlResult,
} from './storage.interface';

export interface StorageTokenPayload {
  key: string;
  operation: 'upload' | 'read';
  expiresAt: number;
  contentType?: string;
}

export class LocalStorageService implements StorageService {
  private readonly baseDir: string;
  private readonly secret: string;

  constructor(baseDir?: string, secret?: string) {
    this.baseDir = path.resolve(process.cwd(), baseDir || env.STORAGE_LOCAL_DIR);
    this.secret = secret || env.STORAGE_SIGNED_URL_SECRET || env.AUTH_SECRET;
  }

  public resolveSafePath(key: string): string {
    // Sanitize key by removing backslashes, leading slashes, and redundant dots
    const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const resolvedPath = path.resolve(this.baseDir, normalizedKey);

    // Strict path traversal check
    if (!resolvedPath.startsWith(this.baseDir + path.sep) && resolvedPath !== this.baseDir) {
      throw new Error(`Security Exception: Path traversal detected for key '${key}'`);
    }

    return resolvedPath;
  }

  public signPayload(payload: StorageTokenPayload): string {
    const jsonStr = JSON.stringify(payload);
    const encodedPayload = Buffer.from(jsonStr).toString('base64url');
    const hmac = crypto
      .createHmac('sha256', this.secret)
      .update(encodedPayload)
      .digest('base64url');

    return `${encodedPayload}.${hmac}`;
  }

  public verifyToken(token: string, expectedOperation: 'upload' | 'read'): StorageTokenPayload {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new Error('Invalid storage token format');
    }

    const [encodedPayload, receivedSignature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(encodedPayload)
      .digest('base64url');

    const receivedBuf = Buffer.from(receivedSignature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (
      receivedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(receivedBuf, expectedBuf)
    ) {
      throw new Error('Invalid storage token signature');
    }

    let payload: StorageTokenPayload;
    try {
      const decodedStr = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
      payload = JSON.parse(decodedStr);
    } catch {
      throw new Error('Malformed storage token payload');
    }

    if (payload.operation !== expectedOperation) {
      throw new Error(`Invalid token operation. Expected ${expectedOperation}, got ${payload.operation}`);
    }

    if (Date.now() > payload.expiresAt) {
      throw new Error('Storage token has expired');
    }

    return payload;
  }

  async generateUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number
  ): Promise<UploadUrlResult> {
    const token = this.signPayload({
      key,
      operation: 'upload',
      contentType,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });

    const uploadUrl = `${env.API_BASE_URL}/api/v1/storage/upload?token=${token}`;
    return {
      uploadUrl,
      requiredHeaders: {
        'Content-Type': contentType,
      },
    };
  }

  async generateSignedReadUrl(
    key: string,
    expiresInSeconds: number
  ): Promise<ReadUrlResult> {
    const token = this.signPayload({
      key,
      operation: 'read',
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });

    const readUrl = `${env.API_BASE_URL}/api/v1/storage/read?token=${token}`;
    return { readUrl };
  }

  async objectExists(key: string): Promise<boolean> {
    const filePath = this.resolveSafePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(key: string): Promise<StorageMetadata | null> {
    const filePath = this.resolveSafePath(key);
    try {
      const stats = await fs.stat(filePath);
      let contentType = 'application/octet-stream';
      try {
        const metaRaw = await fs.readFile(`${filePath}.meta.json`, 'utf-8');
        const meta = JSON.parse(metaRaw);
        if (meta.contentType) contentType = meta.contentType;
      } catch {
        // Fallback to extension-based guess if meta file absent
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.webp') contentType = 'image/webp';
      }

      return {
        size: stats.size,
        contentType,
        lastModified: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  async getObject(key: string): Promise<{ buffer: Buffer; contentType: string; size: number }> {
    const filePath = this.resolveSafePath(key);
    const meta = await this.getObjectMetadata(key);
    if (!meta) {
      throw new Error(`Object '${key}' not found in storage`);
    }

    const buffer = await fs.readFile(filePath);
    return {
      buffer,
      contentType: meta.contentType || 'application/octet-stream',
      size: meta.size,
    };
  }

  async putObject(key: string, buffer: Buffer, contentType: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    await fs.writeFile(
      `${filePath}.meta.json`,
      JSON.stringify({ contentType, createdAt: new Date().toISOString() })
    );
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if already absent
    }
    try {
      await fs.unlink(`${filePath}.meta.json`);
    } catch {
      // Ignore if absent
    }
  }
}
