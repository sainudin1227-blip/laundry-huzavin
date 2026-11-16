import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db';

const COOKIE_NAME = 'huzavin_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function loadOrCreateSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  const secretPath = path.resolve(process.cwd(), 'data', '.session_secret');
  if (fs.existsSync(secretPath)) {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, generated, { mode: 0o600 });
  return generated;
}

const SESSION_SECRET = loadOrCreateSessionSecret();

interface SessionPayload {
  adminId: string;
  username: string;
  exp: number;
}

function signToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.adminId || !parsed.username || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface AdminUserInfo {
  id: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
}

export interface AuthenticatedRequest extends Request {
  admin?: AdminUserInfo;
}

export function authenticateAdminCredentials(username: string, password: string): AdminUserInfo | null {
  const cleanUser = username.trim().toLowerCase();
  const row = db
    .prepare(
      `SELECT id, username, password_hash, display_name, must_change_password
       FROM admin_profiles WHERE LOWER(username) = ?`
    )
    .get(cleanUser) as
    | {
        id: string;
        username: string;
        password_hash: string;
        display_name: string;
        must_change_password: number;
      }
    | undefined;

  if (!row) return null;
  const valid = bcrypt.compareSync(password, row.password_hash);
  if (!valid) return null;

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const origin = String(req.headers.origin ?? '').toLowerCase();
  const referer = String(req.headers.referer ?? '').toLowerCase();
  return (
    req.secure ||
    forwardedProto === 'https' ||
    req.protocol === 'https' ||
    origin.startsWith('https://') ||
    referer.startsWith('https://')
  );
}

export function createAdminSessionToken(admin: AdminUserInfo): string {
  return signToken({
    adminId: admin.id,
    username: admin.username,
    exp: Date.now() + SESSION_TTL_MS,
  });
}

export function setAdminSessionCookie(req: Request, res: Response, admin: AdminUserInfo): string {
  const token = createAdminSessionToken(admin);
  const https = isHttpsRequest(req);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
  return token;
}

export function clearAdminSessionCookie(req: Request, res: Response): void {
  const https = isHttpsRequest(req);
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    path: '/',
  });
}

function extractTokenFromRequest(req: Request): string | null {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }

  // EventSource & protected <img> tags inside strict cross-origin iframes cannot attach custom headers
  if (
    req.method === 'GET' &&
    (req.path === '/api/admin/stream' || req.path.startsWith('/api/admin/clothing-photos/'))
  ) {
    const qToken = req.query?.token;
    if (typeof qToken === 'string' && qToken.trim()) {
      return qToken.trim();
    }
  }

  return null;
}

export function readAdminFromRequest(req: Request): AdminUserInfo | null {
  const token = extractTokenFromRequest(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  const row = db
    .prepare(
      `SELECT id, username, display_name, must_change_password
       FROM admin_profiles WHERE id = ?`
    )
    .get(payload.adminId) as
    | {
        id: string;
        username: string;
        display_name: string;
        must_change_password: number;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    mustChangePassword: Boolean(row.must_change_password),
  };
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const admin = readAdminFromRequest(req);
  if (!admin) {
    res.status(401).json({ error: 'Sesi admin tidak valid atau telah berakhir. Silakan login kembali.' });
    return;
  }
  req.admin = admin;
  next();
}

export function changeAdminPassword(
  adminId: string,
  currentPassword: string,
  newPassword: string
): { ok: boolean; error?: string } {
  const row = db
    .prepare('SELECT password_hash FROM admin_profiles WHERE id = ?')
    .get(adminId) as { password_hash: string } | undefined;

  if (!row) {
    return { ok: false, error: 'Akun admin tidak ditemukan.' };
  }

  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    return { ok: false, error: 'Password saat ini tidak sesuai.' };
  }

  if (newPassword.trim().length < 6) {
    return { ok: false, error: 'Password baru minimal 6 karakter.' };
  }

  const nextHash = bcrypt.hashSync(newPassword, 12);
  db.prepare('UPDATE admin_profiles SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(
    nextHash,
    new Date().toISOString(),
    adminId
  );

  return { ok: true };
}
