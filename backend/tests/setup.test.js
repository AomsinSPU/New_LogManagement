import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { parseEnv } from '../src/config/env.js';
import { createApp } from '../src/app.js';

const input = { POSTGRES_DB: 'test', POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'secret-test-value' };

test('environment defaults and validation do not expose secrets', () => {
  const config = parseEnv(input);
  assert.equal(config.PORT, 3000);
  assert.equal(config.DB_SSL, false);
  assert.equal(parseEnv({ DATABASE_URL: 'postgresql://user:password@localhost/db' }).DB_PORT, 5432);
  for (const override of [{ PORT: 'invalid' }, { FRONTEND_ORIGIN: '*' }, { DB_SSL: 'maybe' },
    { DATABASE_URL: 'postgresql://user:password@localhost/db?sslmode=no-verify' }]) {
    assert.throws(() => parseEnv({ ...input, ...override }), (error) => {
      assert.match(error.message, /Invalid environment variables/);
      assert.ok(!error.message.includes(input.POSTGRES_PASSWORD));
      return true;
    });
  }
  assert.throws(() => parseEnv({}), /POSTGRES_PASSWORD/);
});

test('HTTP health, readiness, CORS and JSON errors', async () => {
  let databaseAvailable = true;
  let stopping = false;
  const app = createApp({
    config: parseEnv(input),
    checkDatabase: async () => { if (!databaseAvailable) throw new Error('database-secret'); },
    isShuttingDown: () => stopping,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.ok(response.headers.get('x-content-type-options'));
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.equal((await fetch(`${base}/ready`)).status, 200);
    databaseAvailable = false;
    response = await fetch(`${base}/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'not_ready' });
    assert.equal((await fetch(`${base}/health`)).status, 200);
    databaseAvailable = true;
    stopping = true;
    assert.equal((await fetch(`${base}/ready`)).status, 503);
    response = await fetch(`${base}/health`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.equal((await fetch(`${base}/health`, { headers: { Origin: 'https://untrusted.invalid' } })).status, 403);
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.equal((await fetch(`${base}/missing`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad',
    })).status, 400);
    assert.equal((await fetch(`${base}/missing`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(1048576) }),
    })).status, 413);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});