import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { authenticate } from '../src/middleware/auth.js';
import { authorize } from '../src/middleware/authorize.js';
import { authenticateIngest, authorizeSource } from '../src/middleware/ingest-auth.js';
import { csrfProtection } from '../src/middleware/csrf.js';
import { validate } from '../src/middleware/validate.js';

async function invoke(middleware, request) {
  let result;
  await middleware(request, { set() {} }, (error) => { result = error?.status ?? 200; });
  return result;
}

test('session authentication hashes credentials and derives identity only from DB', async () => {
  const token = 'a'.repeat(64);
  let accepted = true;
  const pool = { async query(sql, values) {
    assert.ok(!values.includes(token));
    for (const text of ['s.revoked_at IS NULL', 's.expires_at >', 'u.is_active', 't.is_active', 's.last_seen_at >']) assert.ok(sql.includes(text));
    return { rows: accepted ? [{ user_id: 'user-a', tenant_id: 'tenant-a', role: 'viewer' }] : [] };
  } };
  const auth = authenticate({ pool });
  assert.equal(await invoke(auth, {}), 401);
  const request = { cookies: { session: token }, body: { tenant_id: 'tenant-b', role: 'admin' } };
  assert.equal(await invoke(auth, request), 200);
  assert.equal(request.auth.tenant_id, 'tenant-a');
  assert.equal(await invoke(authorize('admin'), request), 403);
  assert.equal(await invoke(authorize('viewer'), request), 200);
  assert.equal(await invoke(authorize('admin'), {}), 401);
  accepted = false;
  assert.equal(await invoke(auth, request), 401);
});

test('ingest key and source authorization reject missing or disallowed credentials', async () => {
  let accepted = true;
  const middleware = authenticateIngest({ pool: { async query(sql, values) {
    assert.ok(sql.includes('k.revoked_at IS NULL'));
    assert.ok(sql.includes('k.expires_at >'));
    assert.equal(values[0].length, 64);
    return { rows: accepted ? [{ tenant_id: 'tenant-a', allowed_sources: ['ad'] }] : [] };
  } } });
  assert.equal(await invoke(middleware, { get: () => '' }), 401);
  const request = { get: () => `Bearer ${'b'.repeat(64)}`, validated: { body: { source: 'ad' } } };
  assert.equal(await invoke(middleware, request), 200);
  assert.equal(await invoke(authorizeSource, request), 200);
  request.validated.body.source = 'aws';
  assert.equal(await invoke(authorizeSource, request), 403);
  assert.equal(await invoke(authorize('admin'), request), 403);
  accepted = false;
  assert.equal(await invoke(middleware, request), 401);
});

test('validation stores parsed input separately and CSRF rejects absent/foreign Origin', async () => {
  const middleware = validate({ body: z.object({ count: z.coerce.number().int().positive() }).strict() });
  const request = { body: { count: '2' } };
  assert.equal(await invoke(middleware, request), 200);
  assert.equal(request.validated.body.count, 2);
  assert.equal(request.body.count, '2');
  assert.equal(await invoke(middleware, { body: { count: -1 } }), 400);
  const csrf = csrfProtection({ FRONTEND_ORIGIN: 'http://localhost:5173' });
  assert.equal(await invoke(csrf, { method: 'GET' }), 200);
  for (const origin of [undefined, 'null', 'https://evil.invalid']) {
    assert.equal(await invoke(csrf, { method: 'POST', get: () => origin }), 403);
  }
  assert.equal(await invoke(csrf, { method: 'POST', get: () => 'http://localhost:5173' }), 200);
});