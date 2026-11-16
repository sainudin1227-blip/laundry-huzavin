import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { initDatabase } from './db';
import {
  authenticateAdminCredentials,
  createAdminSessionToken,
  readAdminFromRequest,
  setAdminSessionCookie,
} from './auth';

initDatabase();

test('authenticateAdminCredentials validates seeded huzavin/abiumi securely', () => {
  const valid = authenticateAdminCredentials('huzavin', 'abiumi');
  assert.ok(valid);
  assert.equal(valid.username, 'huzavin');

  const wrong = authenticateAdminCredentials('huzavin', 'wrongpass');
  assert.equal(wrong, null);
});

test('setAdminSessionCookie sets adaptive SameSite/Secure for proxy HTTPS vs local HTTP', () => {
  const admin = authenticateAdminCredentials('huzavin', 'abiumi');
  assert.ok(admin);

  let capturedOpts: Record<string, unknown> | undefined;
  const mockRes = {
    cookie: (_name: string, _val: string, opts: Record<string, unknown>) => {
      capturedOpts = opts;
    },
  } as unknown as Response;

  // HTTPS behind Cloud Run / reverse proxy
  const httpsReq = {
    secure: false,
    protocol: 'http',
    headers: { 'x-forwarded-proto': 'https' },
  } as unknown as Request;
  const token = setAdminSessionCookie(httpsReq, mockRes, admin);
  assert.ok(token.includes('.'));
  assert.equal(capturedOpts?.httpOnly, true);
  assert.equal(capturedOpts?.sameSite, 'none');
  assert.equal(capturedOpts?.secure, true);

  // Local HTTP localhost:3000
  const httpReq = {
    secure: false,
    protocol: 'http',
    headers: { host: 'localhost:3000' },
  } as unknown as Request;
  setAdminSessionCookie(httpReq, mockRes, admin);
  assert.equal(capturedOpts?.httpOnly, true);
  assert.equal(capturedOpts?.sameSite, 'lax');
  assert.equal(capturedOpts?.secure, false);
});

test('readAdminFromRequest accepts cookie, Bearer token, and stream/photo query token only', () => {
  const admin = authenticateAdminCredentials('huzavin', 'abiumi');
  assert.ok(admin);
  const token = createAdminSessionToken(admin);

  // 1. Cookie
  const byCookie = readAdminFromRequest({
    method: 'GET',
    path: '/api/admin/overview',
    cookies: { huzavin_admin_session: token },
    headers: {},
    query: {},
  } as unknown as Request);
  assert.equal(byCookie?.username, 'huzavin');

  // 2. Authorization Bearer fallback (strict 3P cookie iframe blocking)
  const byBearer = readAdminFromRequest({
    method: 'GET',
    path: '/api/admin/overview',
    cookies: {},
    headers: { authorization: `Bearer ${token}` },
    query: {},
  } as unknown as Request);
  assert.equal(byBearer?.username, 'huzavin');

  // 3. Query token allowed for SSE stream and protected photo GET endpoints
  const byStreamQuery = readAdminFromRequest({
    method: 'GET',
    path: '/api/admin/stream',
    cookies: {},
    headers: {},
    query: { token },
  } as unknown as Request);
  assert.equal(byStreamQuery?.username, 'huzavin');

  // 4. Query token rejected on arbitrary data/mutation routes
  const byDataQuery = readAdminFromRequest({
    method: 'GET',
    path: '/api/admin/overview',
    cookies: {},
    headers: {},
    query: { token },
  } as unknown as Request);
  assert.equal(byDataQuery, null);

  // 5. Tampered token rejected
  const tampered = readAdminFromRequest({
    method: 'GET',
    path: '/api/admin/overview',
    cookies: {},
    headers: { authorization: `Bearer ${token}tamper` },
    query: {},
  } as unknown as Request);
  assert.equal(tampered, null);
});
