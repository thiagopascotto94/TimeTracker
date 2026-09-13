import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'time_tracker_jwt_secret_key_2026_secure';
const JWT_EXPIRES_IN = '7d';

export interface JwtPayload {
  userId: string;
  tenantId: string;
}

export function generateToken(userId: string, tenantId: string): string {
  return jwt.sign({ userId, tenantId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (err) {
    return null;
  }
}
