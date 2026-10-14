import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { env } from '../../config/env';
import { UnauthorizedError } from '../errors/app-error';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  companyId?: string;
}

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.AUTH_SECRET, {
    expiresIn: env.AUTH_ACCESS_TOKEN_EXPIRY,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.AUTH_SECRET) as AccessTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token expired', 'TOKEN_EXPIRED');
    }
    throw new UnauthorizedError('Invalid access token', 'INVALID_TOKEN');
  }
}

export function generateRefreshToken(): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  // 64 random bytes hex = 128 characters
  const token = randomBytes(64).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.AUTH_REFRESH_TOKEN_EXPIRY_DAYS);

  return {
    token,
    tokenHash,
    expiresAt,
  };
}
