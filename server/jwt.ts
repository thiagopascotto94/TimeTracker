import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { RefreshToken, User } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'time_tracker_jwt_secret_key_2026_secure';
const ACCESS_TOKEN_EXPIRES_IN = '1h';
const REFRESH_TOKEN_DAYS = 30;

export interface JwtPayload {
  userId: string;
  tenantId: string;
}

/**
 * Generate short-lived JWT Access Token
 */
export function generateAccessToken(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

// Backwards-compatible alias
export const generateToken = generateAccessToken;

/**
 * Verify JWT Access Token
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}

// Backwards-compatible alias
export const verifyToken = verifyAccessToken;

/**
 * Generate cryptographically secure Refresh Token and store in database
 */
export async function generateRefreshToken(userId: string, tenantId: string): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await RefreshToken.create({
    user_id: userId,
    tenant_id: tenantId,
    token,
    expires_at: expiresAt,
    revoked: false,
  });

  return token;
}

/**
 * Verify Refresh Token from database
 */
export async function verifyRefreshToken(token: string): Promise<{ userId: string; tenantId: string } | null> {
  if (!token) return null;

  try {
    const record = await RefreshToken.findOne({
      where: {
        token,
        revoked: false,
      },
    });

    if (!record) return null;

    if (new Date() > new Date(record.expires_at)) {
      // Token has expired
      await record.update({ revoked: true });
      return null;
    }

    // Ensure user still exists
    const user = await User.findByPk(record.user_id);
    if (!user) {
      await record.update({ revoked: true });
      return null;
    }

    return {
      userId: record.user_id,
      tenantId: record.tenant_id,
    };
  } catch (err) {
    console.error('Error verifying refresh token:', err);
    return null;
  }
}

/**
 * Rotate Refresh Token: Revokes old token and generates new Access Token and Refresh Token pair
 */
export async function rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string; userId: string; tenantId: string } | null> {
  if (!oldToken) return null;

  try {
    const record = await RefreshToken.findOne({
      where: {
        token: oldToken,
        revoked: false,
      },
    });

    if (!record || new Date() > new Date(record.expires_at)) {
      if (record) await record.update({ revoked: true });
      return null;
    }

    // Revoke old refresh token immediately (prevent reuse attack)
    await record.update({ revoked: true });

    // Issue new pair
    const accessToken = generateAccessToken(record.user_id, record.tenant_id);
    const newRefreshToken = await generateRefreshToken(record.user_id, record.tenant_id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      userId: record.user_id,
      tenantId: record.tenant_id,
    };
  } catch (err) {
    console.error('Error rotating refresh token:', err);
    return null;
  }
}

/**
 * Revoke a specific Refresh Token (e.g. on logout)
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const [count] = await RefreshToken.update({ revoked: true }, { where: { token } });
    return count > 0;
  } catch (err) {
    console.error('Error revoking refresh token:', err);
    return false;
  }
}

/**
 * Revoke all active Refresh Tokens for a user (e.g. after password reset)
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    await RefreshToken.update({ revoked: true }, { where: { user_id: userId, revoked: false } });
    return true;
  } catch (err) {
    console.error('Error revoking all refresh tokens for user:', err);
    return false;
  }
}

