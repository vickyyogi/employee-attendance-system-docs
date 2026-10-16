import express, { Router, Request, Response } from 'express';
import { getStorageService } from '../../infrastructure/storage/storage.factory';
import { LocalStorageService } from '../../infrastructure/storage/local-storage.service';

const router = Router();

// Middleware for raw binary upload payloads up to 10MB
const rawBodyParser = express.raw({
  type: () => true,
  limit: '10mb',
});

/**
 * Direct signed upload endpoint for storage provider (Local storage implementation)
 * Validates HMAC token signature and expiry before writing to private disk.
 */
router.put('/upload', rawBodyParser, async (req: Request, res: Response) => {
  const token = req.query.token;
  if (!token || typeof token !== 'string') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Missing or invalid signed storage token',
      },
    });
    return;
  }

  const storage = getStorageService();
  if (!(storage instanceof LocalStorageService)) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Direct API storage upload is only supported for local storage provider',
      },
    });
    return;
  }

  try {
    const payload = storage.verifyToken(token, 'upload');
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

    if (buffer.length === 0) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Empty file payload received',
        },
      });
      return;
    }

    const contentType =
      (req.headers['content-type'] as string) || payload.contentType || 'image/jpeg';

    await storage.putObject(payload.key, buffer, contentType);

    res.status(200).json({
      data: {
        success: true,
        sizeBytes: buffer.length,
        contentType,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storage token verification failed';
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message,
      },
    });
  }
});

/**
 * Direct signed read endpoint for storage provider (Local storage implementation)
 * Validates HMAC token signature and expiry before streaming private binary.
 */
router.get('/read', async (req: Request, res: Response) => {
  const token = req.query.token;
  if (!token || typeof token !== 'string') {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Missing or invalid signed storage token',
      },
    });
    return;
  }

  const storage = getStorageService();
  if (!(storage instanceof LocalStorageService)) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Direct API storage read is only supported for local storage provider',
      },
    });
    return;
  }

  try {
    const payload = storage.verifyToken(token, 'read');
    const { buffer, contentType } = await storage.getObject(payload.key);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Content-Disposition', 'inline');

    res.status(200).send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storage token verification failed';
    if (message.includes('not found')) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message,
        },
      });
      return;
    }
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message,
      },
    });
  }
});

export { router as storageRouter };
