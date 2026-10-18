import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { loadEnv } from '../src/config/env.js';
import { createDatabase } from '../src/db/pool.js';
import { createApp } from '../src/app.js';
import { authenticateIngest } from '../src/middleware/ingest-auth.js';

const config = loadEnv();
const admin = createDatabase(config);
const name = 'keys_test_' + randomBytes(8).toString('hex');
let database, server;
let created = false;
try {
  await admin.pool.query(`CREATE DATABASE "${name}"`);
  created = true;
  const url = config.DATABASE_URL ? new URL(config.DATABASE_URL) : null;
  if (url) url.pathname = '/' + name;
  database = createDatabase({ ...config, DATABASE_URL: url?.toString(), POSTGRES_DB: name });
  const dir = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
    await database.pool.query(await readFile(new URL(file, dir), 'utf8'));
  }
  const cookies = [];
  for (const [index, role] of ['admin', 'admin', 'viewer'].entries()) {
    const { rows: [tenant] } = await database.pool.query('INSERT INTO tenants(slug,name) VALUES($1,$1) RETURNING id', ['test-' + index]);
    const { rows: [user] } = await database.pool.query(`INSERT INTO users(tenant_id,email,password_hash,display_name,role)
      VALUES($1,$2,'!test-only','Test',$3) RETURNING id`, [tenant.id, `user${index}@test.invalid`, role]);
    const token = randomBytes(32).toString('hex');
    await database.pool.query(`INSERT INTO user_sessions(user_id,token_hash,expires_at)
      VALUES($1,$2,clock_timestamp()+interval '1 hour')`, [user.id, createHash('sha256').update(token).digest('hex')]);
    cookies.push('session=' + token);
  }
  server = createApp({ config, pool: database.pool, checkDatabase: database.check }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/ingest-keys`;
  const request = (method, cookie, body, suffix = '', origin = config.FRONTEND_ORIGIN) => fetch(base + suffix, {
    method, headers: { Cookie: cookie ?? '', Origin: origin, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = { name: 'Test key', allowed_sources: ['api', 'ad'] };
  assert.equal((await request('GET')).status, 401);
  for (const method of ['GET', 'POST', 'DELETE']) {
    assert.equal((await request(method, cookies[2], method === 'POST' ? payload : undefined,
      method === 'DELETE' ? '/00000000-0000-4000-8000-000000000001' : '')).status, 403);
  }
  assert.equal((await request('POST', cookies[0], payload, '', 'https://evil.invalid')).status, 403);
  assert.equal((await request('POST', cookies[0], { ...payload, tenant_id: 'fake' })).status, 400);
  let response = await request('POST', cookies[0], payload);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { key, secret } = await response.json();
  assert.equal(key.key_hash, undefined);
  const stored = await database.pool.query('SELECT key_hash FROM ingest_keys WHERE id=$1', [key.id]);
  assert.equal(stored.rows[0].key_hash, createHash('sha256').update(secret).digest('hex'));
  const authenticate = async () => {
    let status;
    await authenticateIngest({ pool: database.pool })({ get: () => `Bearer ${secret}` }, {}, error => { status = error?.status ?? 200; });
    return status;
  };
  assert.equal(await authenticate(), 200);
  const ingestUrl = base.replace('/ingest-keys', '/ingest');
  const raw = '{\n  "source": "api", "event_type": "authentication", "outcome": "failure", "src_ip": "203.0.113.10", "user": "alice"\n}';
  const send = (body = raw, token = secret, type = 'application/json') => fetch(ingestUrl, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': type }, body,
  });
  assert.equal((await send(raw, 'invalid')).status, 401);
  assert.equal((await send(raw, secret, 'text/plain')).status, 415);
  assert.equal((await send(raw.replace('"api"', '"aws"'))).status, 403);
  assert.equal((await send(JSON.stringify({ source: 'api', event_type: 'test', tenant_id: 'fake' }))).status, 400);
  assert.equal((await send(raw.replace('203.0.113.10', 'invalid-ip'))).status, 400);
  assert.equal((await send('{broken')).status, 400);
  const ingested = await send();
  assert.equal(ingested.status, 201);
  const { data: log } = await ingested.json();
  const { rows: [saved] } = await database.pool.query('SELECT * FROM logs WHERE id=$1', [log.id]);
  const { rows: [owner] } = await database.pool.query('SELECT tenant_id FROM ingest_keys WHERE id=$1', [key.id]);
  assert.equal(saved.tenant_id, owner.tenant_id);
  assert.equal(saved.ingest_key_id, key.id);
  assert.equal(saved.raw, raw);
  assert.equal(saved.actor_user, 'alice');
  assert.ok(saved.tags.includes('timestamp_inferred'));
  const logsUrl = base.replace('/ingest-keys', '/logs');
  const getLogs = (suffix = '', cookie = cookies[0]) => fetch(logsUrl + suffix, { headers: { Cookie: cookie } });
  assert.equal((await getLogs('', '')).status, 401);
  assert.equal((await getLogs('', `session=${secret}`)).status, 401);
  let logsResponse = await getLogs();
  assert.equal(logsResponse.status, 200);
  const logList = await logsResponse.json();
  assert.equal(logList.data[0].id, log.id);
  assert.equal(logList.data[0].raw, undefined);
  assert.equal(logsResponse.headers.get('cache-control'), 'no-store');
  assert.equal((await (await getLogs('/' + log.id)).json()).data.raw, raw);
  assert.equal((await getLogs('/' + log.id, cookies[1])).status, 404);
  assert.equal((await (await getLogs('', cookies[1])).json()).data.length, 0);
  assert.equal((await getLogs('/invalid')).status, 400);
  assert.equal((await getLogs('?tenant_id=other')).status, 400);
  assert.equal((await getLogs('?limit=101')).status, 400);
  assert.equal((await (await getLogs('?source=aws')).json()).data.length, 0);
  assert.equal((await (await getLogs('?source=api&user=alice&src_ip=203.0.113.10&event_type=authentication&outcome=failure')).json()).data.length, 1);
  // Give the existing viewer its own event to verify read access without cross-tenant leakage.
  await database.pool.query(`INSERT INTO logs(tenant_id,event_timestamp,source,event_type,raw)
    SELECT tenant_id,clock_timestamp(),'api','viewer_test','viewer fixture' FROM users WHERE email='user2@test.invalid'`);
  const viewerList = await (await getLogs('', cookies[2])).json();
  assert.equal(viewerList.data.length, 1);
  assert.equal((await getLogs('/' + viewerList.data[0].id, cookies[2])).status, 200);
  assert.equal((await getLogs('/' + log.id, cookies[2])).status, 404);
  const second = await send(JSON.stringify({ source: 'api', event_type: 'authentication',
    '@timestamp': '2026-01-01T00:00:00Z', message: 'Unique searchable marker', severity: 0 }));
  assert.equal(second.status, 201);
  const secondId = (await second.json()).data.id;
  const search = await (await getLogs('?q=searchable&severity=0&from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z')).json();
  assert.equal(search.data.length, 1);
  assert.equal(search.data[0].id, secondId);
  assert.equal((await (await getLogs('?to=2026-01-01T00:00:00Z&q=searchable')).json()).data.length, 0);
  const page1 = await (await getLogs('?limit=1')).json();
  const page2 = await (await getLogs('?limit=1&offset=1')).json();
  assert.equal(page1.pagination.has_more, true);
  assert.equal(page2.pagination.has_more, false);
  assert.notEqual(page1.data[0].id, page2.data[0].id);
  assert.equal((await (await getLogs('?user=' + encodeURIComponent("' OR 1=1 --"))).json()).data.length, 0);
  response = await request('GET', cookies[0]);
  const listing = await response.json();
  assert.equal(listing.data.length, 1);
  assert.ok(!JSON.stringify(listing).includes(secret));
  assert.ok(!JSON.stringify(listing).includes('key_hash'));
  assert.equal((await (await request('GET', cookies[1])).json()).data.length, 0);
  assert.equal((await request('DELETE', cookies[1], undefined, '/' + key.id)).status, 404);
  assert.equal(await authenticate(), 200);
  assert.equal((await request('DELETE', cookies[0], undefined, '/' + key.id)).status, 204);
  assert.equal((await request('DELETE', cookies[0], undefined, '/' + key.id)).status, 204);
  assert.equal(await authenticate(), 401);
  assert.equal((await send()).status, 401);
  assert.equal(Number((await database.pool.query('SELECT count(*) FROM logs')).rows[0].count), 3);
  const importUrl = base.replace('/ingest-keys', '/imports');
  const batchBody = { source: 'api', filename: 'demo.json', records: [
    { source: 'api', event_type: 'batch-test', message: 'Accepted batch record' },
    { source: 'api', event_type: 'invalid', severity: 99 },
    { source: 'aws', event_type: 'wrong-source' },
  ] };
  const importRequest = (cookie, body = batchBody) => fetch(importUrl, {
    method: 'POST', headers: { Cookie: cookie, Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal((await importRequest(cookies[2])).status, 403);
  const imported = await importRequest(cookies[0]);
  assert.equal(imported.status, 201);
  const { data: batch } = await imported.json();
  assert.equal(batch.status, 'partial');
  assert.equal(batch.accepted_count, 1);
  assert.equal(batch.rejected_count, 2);
  const batchLogs = await database.pool.query('SELECT tenant_id,ingest_key_id,raw FROM logs WHERE batch_id=$1', [batch.id]);
  assert.equal(batchLogs.rowCount, 1);
  assert.equal(batchLogs.rows[0].ingest_key_id, null);
  assert.equal(batchLogs.rows[0].tenant_id, owner.tenant_id);
  assert.equal((await fetch(importUrl + '/' + batch.id, { headers: { Cookie: cookies[1] } })).status, 404);
  assert.equal((await fetch(importUrl + '/' + batch.id, { headers: { Cookie: cookies[0] } })).status, 200);
  const failed = await importRequest(cookies[0], { source: 'api', records: [null] });
  assert.equal((await failed.json()).data.status, 'failed');
  assert.equal((await importRequest(cookies[0], { source: 'api', records: [] })).status, 400);
  // Create another active machine key after revoking the first one.
  const active = await (await request('POST', cookies[0], payload)).json();
  const batchSend = body => fetch(ingestUrl + '/batch', { method: 'POST',
    headers: { Authorization: `Bearer ${active.secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const machine = await batchSend({ source: 'api', records: [batchBody.records[0]] });
  assert.equal(machine.status, 201);
  const machineBatch = (await machine.json()).data;
  assert.equal(machineBatch.status, 'completed');
  const provenance = await database.pool.query('SELECT ingest_key_id FROM logs WHERE batch_id=$1', [machineBatch.id]);
  assert.equal(provenance.rows[0].ingest_key_id, active.key.id);
  assert.equal((await batchSend({ source: 'aws', records: [{ source: 'aws', event_type: 'test' }] })).status, 403);
  console.log('Batch/import integration passed: partial/completed/failed results, provenance, tenant isolation, Viewer rejection and source permissions.');
  assert.equal((await request('DELETE', cookies[0], undefined, '/not-a-uuid')).status, 400);
  console.log('Ingest key integration passed: create/list/revoke, secret hashing, RBAC, tenant isolation, CSRF, repeat revoke and rejected revoked key.');
  console.log('Logs integration passed: ingest to search/detail, filters, pagination, Viewer access, tenant isolation and SQL injection input.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await database?.close();
  if (created) await admin.pool.query(`DROP DATABASE "${name}"`);
  await admin.close();
}