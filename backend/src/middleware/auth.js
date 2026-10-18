import { createHash } from 'node:crypto';
import { httpError } from './http-error.js';

// Future login must issue 32 random bytes encoded as 64 hex characters,
// storing their lowercase SHA-256 hex digest in user_sessions.token_hash.
export function authenticate({ pool, cookieName = 'session', idleSeconds = 1800 }) {
  if (!Number.isInteger(idleSeconds) || idleSeconds < 1) throw new Error('Invalid idle timeout');
  return async (request, response, next) => {
    const token = request.cookies?.[cookieName];
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return next(httpError(401));
    const hash = createHash('sha256').update(token).digest('hex');
    const { rows } = await pool.query(`
      UPDATE public.user_sessions s SET last_seen_at = clock_timestamp()
      FROM public.users u, public.tenants t
      WHERE s.user_id = u.id AND u.tenant_id = t.id
        AND s.token_hash = $1 AND s.revoked_at IS NULL
        AND s.expires_at > clock_timestamp()
        AND s.last_seen_at > clock_timestamp() - ($2 * interval '1 second')
        AND u.is_active AND t.is_active
      RETURNING s.id AS session_id, u.id AS user_id, u.tenant_id, u.role
    `, [hash, idleSeconds]);
    if (!rows.length) return next(httpError(401));
    request.auth = Object.freeze({ type: 'session', ...rows[0] });
    response.set('Cache-Control', 'no-store');
    next();
  };
}