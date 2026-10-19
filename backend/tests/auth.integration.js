// Explicit opt-in: node tests/auth.integration.js. Uses a disposable database.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { once } from 'node:events';
import argon2 from 'argon2';
import { loadEnv } from '../src/config/env.js';
import { createDatabase } from '../src/db/pool.js';
import { createApp } from '../src/app.js';

const config = loadEnv();
const admin = createDatabase(config);
const name = 'auth_test_' + randomBytes(8).toString('hex');
let database;
let server;
let created = false;
try {
  await admin.pool.query(`CREATE DATABASE "${name}"`);
  created = true;
  const connection = config.DATABASE_URL ? new URL(config.DATABASE_URL) : null;
  if (connection) connection.pathname = '/' + name;
  database = createDatabase({ ...config, DATABASE_URL: connection?.toString(), POSTGRES_DB: name });
  const dir = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) {
    await database.pool.query(await readFile(new URL(file, dir), 'utf8'));
  }
  const { rows: [tenant] } = await database.pool.query("INSERT INTO tenants(slug,name) VALUES('auth-test','Auth test') RETURNING id");
  const password = randomBytes(24).toString('hex');
  const email = 'auth@test.invalid';
  await database.pool.query(`INSERT INTO users(tenant_id,email,password_hash,display_name,role)
    VALUES($1,$2,$3,'Test','admin')`, [tenant.id, email, await argon2.hash(password)]);
  const app = createApp({ config, pool: database.pool, checkDatabase: database.check });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: config.FRONTEND_ORIGIN, 'Content-Type': 'application/json' };
  const login = (body, extra = {}) => fetch(base + '/auth/login', { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  assert.equal((await fetch(base + '/auth/me')).status, 401);
  assert.equal((await login({ email, password }, { Origin: 'https://evil.invalid' })).status, 403);
  assert.equal((await login({ email, password: 'wrong' })).status, 401);
  let result = await login({ email, password, remember: true });
  assert.equal(result.status, 200);
  const cookie = result.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Max-Age=/i);
  const sessionCookie = cookie.split(';')[0];
  const loggedIn = (await result.json()).user;
  assert.equal(loggedIn.tenant_id, tenant.id);
  assert.deepEqual(loggedIn.tenant, {id:tenant.id,name:'Auth test',slug:'auth-test'});
  result = await fetch(base + '/auth/me', { headers: { Cookie: sessionCookie } });
  assert.equal(result.status, 200);
  const me = (await result.json()).user;
  assert.equal(me.email, email);
  assert.deepEqual(me.tenant, loggedIn.tenant);
  assert.equal((await fetch(base + '/auth/logout', { method: 'POST', headers: { ...headers, Cookie: sessionCookie } })).status, 204);
  assert.equal((await fetch(base + '/auth/me', { headers: { Cookie: sessionCookie } })).status, 401);
  for (let i = 0; i < 11; i++) result = await login({ email, password: 'wrong' });
  assert.equal(result.status, 429);
  const { rows: [session] } = await database.pool.query('SELECT token_hash,revoked_at FROM user_sessions LIMIT 1');
  assert.ok(session.revoked_at);
  assert.notEqual(session.token_hash, sessionCookie.slice('session='.length));
  console.log('Auth integration passed: login, cookie, me, logout, revoked session, CSRF, wrong password, rate limit.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await database?.close();
  if (created) await admin.pool.query(`DROP DATABASE "${name}"`);
  await admin.close();
}