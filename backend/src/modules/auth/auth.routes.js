import { Router } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { authenticate } from '../../middleware/auth.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { httpError } from '../../middleware/http-error.js';

export function createAuthRouter({ pool, config }) {
  const router = Router();
  const cookie = { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
  const digest = (token) => createHash('sha256').update(token).digest('hex');
  const dummyHash = argon2.hash(randomBytes(32), { type: argon2.argon2id });
  // Bounded, process-local limiter. Use a shared gateway/store before scaling replicas.
  const attempts = new Map();
  function limit(request, response, next) {
    const now = Date.now();
    for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
    const key = request.ip;
    if (!attempts.has(key)) {
      if (attempts.size >= 10000) return next(httpError(429));
      attempts.set(key, { count: 0, until: now + 15 * 60 * 1000 });
    }
    const item = attempts.get(key);
    if (++item.count > 10) {
      response.set('Retry-After', String(Math.ceil((item.until - now) / 1000)));
      return next(httpError(429));
    }
    next();
  }
  router.use((request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.post('/login', csrfProtection(config), limit, validate({ body: z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(1024),
    remember: z.boolean().default(false),
  }).strict() }), async (request, response, next) => {
    const { email, password, remember } = request.validated.body;
    const { rows: [user] } = await pool.query(`SELECT u.*, t.is_active AS tenant_active, t.name AS tenant_name, t.slug AS tenant_slug
      FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.email=$1`, [email]);
    let valid = false;
    const hash = user?.password_hash?.startsWith('$argon2') ? user.password_hash : await dummyHash;
    try { valid = await argon2.verify(hash, password); } catch { valid = false; }
    if (!valid || !user?.is_active || !user.tenant_active) return next(httpError(401));
    const token = randomBytes(32).toString('hex');
    const lifetime = remember ? 7 * 86400 : 8 * 3600;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const active = await client.query(`SELECT u.id FROM users u JOIN tenants t ON t.id=u.tenant_id
        WHERE u.id=$1 AND u.is_active AND t.is_active AND u.password_hash=$2 FOR SHARE OF u,t`, [user.id, user.password_hash]);
      if (!active.rowCount) throw httpError(401);
      const old = request.cookies?.session;
      if (typeof old === 'string' && /^[a-f0-9]{64}$/.test(old)) {
        await client.query('UPDATE user_sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1 AND revoked_at IS NULL', [digest(old)]);
      }
      await client.query(`INSERT INTO user_sessions(user_id,token_hash,expires_at,user_agent)
        VALUES($1,$2,clock_timestamp()+($3 * interval '1 second'),$4)`,
      [user.id, digest(token), lifetime, (request.get('user-agent') ?? '').slice(0, 512)]);
      await client.query('UPDATE users SET last_login_at=clock_timestamp() WHERE id=$1', [user.id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    response.cookie('session', token, { ...cookie, ...(remember ? { maxAge: lifetime * 1000 } : {}) });
    response.json({ user: { id: user.id, tenant_id: user.tenant_id, email: user.email, display_name: user.display_name, role: user.role,
      tenant: { id: user.tenant_id, name: user.tenant_name, slug: user.tenant_slug } } });
  });
  router.get('/me', authenticate({ pool }), async (request, response) => {
    const { rows: [user] } = await pool.query(`SELECT u.id,u.tenant_id,u.email,u.display_name,u.role,
      jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug) AS tenant FROM users u JOIN tenants t ON t.id=u.tenant_id
      WHERE u.id=$1 AND u.tenant_id=$2`, [request.auth.user_id, request.auth.tenant_id]);
    response.json({ user });
  });
  router.post('/logout', csrfProtection(config), async (request, response) => {
    const token = request.cookies?.session;
    if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
      await pool.query('UPDATE user_sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1 AND revoked_at IS NULL', [digest(token)]);
    }
    response.clearCookie('session', cookie);
    response.status(204).end();
  });
  return router;
}