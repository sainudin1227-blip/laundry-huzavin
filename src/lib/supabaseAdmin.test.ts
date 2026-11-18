import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  changeSupabaseAdminPassword,
  clearAdminSession,
  getStoredAdminSession,
  loginAdminWithSupabase,
  verifyStoredAdminWithSupabase,
} from './supabaseAdmin';

interface FakeAdminRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  must_change_password: boolean;
}

function makeFakeSupabaseClient(initialRows: FakeAdminRow[]): SupabaseClient {
  const rows = initialRows.map((r) => ({ ...r }));

  return {
    from(table: string) {
      assert.equal(table, 'admin_profiles');
      return {
        select() {
          const filters: Array<{ type: 'ilike' | 'eq'; col: keyof FakeAdminRow; val: string }> = [];
          const query = {
            ilike(col: keyof FakeAdminRow, val: string) {
              filters.push({ type: 'ilike', col, val });
              return query;
            },
            eq(col: keyof FakeAdminRow, val: string) {
              filters.push({ type: 'eq', col, val });
              return query;
            },
            async maybeSingle() {
              const found = rows.find((row) =>
                filters.every((f) => {
                  const candidate = String(row[f.col] ?? '');
                  return f.type === 'ilike'
                    ? candidate.toLowerCase() === f.val.toLowerCase()
                    : candidate === f.val;
                })
              );
              return { data: found ?? null, error: null };
            },
          };
          return query;
        },
        update(patch: Partial<FakeAdminRow>) {
          return {
            async eq(col: keyof FakeAdminRow, val: string) {
              const idx = rows.findIndex((r) => String(r[col]) === val);
              if (idx >= 0) {
                rows[idx] = { ...rows[idx], ...patch };
              }
              return { error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

test('loginAdminWithSupabase returns clear error when Supabase client is not configured', async () => {
  clearAdminSession();
  const res = await loginAdminWithSupabase('huzavin', 'abiumi', null);
  assert.equal(res.ok, false);
  assert.match(res.error ?? '', /VITE_SUPABASE_URL/);
  assert.equal(getStoredAdminSession(), null);
});

test('loginAdminWithSupabase authenticates against admin_profiles bcrypt hash and stores session', async () => {
  clearAdminSession();
  const hash = bcrypt.hashSync('abiumi', 10);
  const client = makeFakeSupabaseClient([
    {
      id: 'admin-uuid-1',
      username: 'huzavin',
      password_hash: hash,
      display_name: 'Huzavin',
      must_change_password: true,
    },
  ]);

  const badRes = await loginAdminWithSupabase('huzavin', 'wrongpass', client);
  assert.equal(badRes.ok, false);
  assert.equal(badRes.error, 'Username atau password salah');
  assert.equal(getStoredAdminSession(), null);

  const missingUserRes = await loginAdminWithSupabase('bukanadmin', 'abiumi', client);
  assert.equal(missingUserRes.ok, false);
  assert.equal(missingUserRes.error, 'Username atau password salah');

  const okRes = await loginAdminWithSupabase(' Huzavin ', 'abiumi', client);
  assert.equal(okRes.ok, true);
  assert.equal(okRes.admin?.username, 'huzavin');
  assert.equal(okRes.admin?.id, 'admin-uuid-1');

  const stored = getStoredAdminSession();
  assert.equal(stored?.username, 'huzavin');

  const verified = await verifyStoredAdminWithSupabase(client);
  assert.equal(verified?.id, 'admin-uuid-1');

  clearAdminSession();
  assert.equal(getStoredAdminSession(), null);
});

test('changeSupabaseAdminPassword validates old password and updates hash in admin_profiles', async () => {
  clearAdminSession();
  const hash = bcrypt.hashSync('abiumi', 10);
  const client = makeFakeSupabaseClient([
    {
      id: 'admin-uuid-1',
      username: 'huzavin',
      password_hash: hash,
      display_name: 'Huzavin',
      must_change_password: true,
    },
  ]);

  await loginAdminWithSupabase('huzavin', 'abiumi', client);

  const wrongOld = await changeSupabaseAdminPassword('admin-uuid-1', 'salah', 'baru1234', client);
  assert.equal(wrongOld.ok, false);

  const okChange = await changeSupabaseAdminPassword('admin-uuid-1', 'abiumi', 'baru1234', client);
  assert.equal(okChange.ok, true);
  assert.equal(getStoredAdminSession()?.mustChangePassword, false);

  // Old password no longer works, new password succeeds
  clearAdminSession();
  const oldLogin = await loginAdminWithSupabase('huzavin', 'abiumi', client);
  assert.equal(oldLogin.ok, false);

  const newLogin = await loginAdminWithSupabase('huzavin', 'baru1234', client);
  assert.equal(newLogin.ok, true);
});
