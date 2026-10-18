import { createHash } from 'node:crypto';
import { httpError } from './http-error.js';

export function authenticateIngest({ pool }) {
  return async (request, response, next) => {
    const match = /^Bearer ([a-f0-9]{64})$/.exec(request.get('authorization') ?? '');
    if (!match) return next(httpError(401));
    const hash = createHash('sha256').update(match[1]).digest('hex');
    const { rows } = await pool.query(`
      UPDATE public.ingest_keys k SET last_used_at = clock_timestamp()
      FROM public.tenants t
      WHERE k.tenant_id = t.id AND t.is_active AND k.key_hash = $1
        AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at > clock_timestamp())
      RETURNING k.id AS ingest_key_id, k.tenant_id, k.allowed_sources
    `, [hash]);
    if (!rows.length) return next(httpError(401));
    request.auth = Object.freeze({ type: 'ingest', ...rows[0] });
    next();
  };
}

// After validate(): the future ingest API uses { source, records } for batches.
export function authorizeSource(request, response, next) {
  if (!request.auth) return next(httpError(401));
  if (request.auth.type !== 'ingest') return next(httpError(403));
  const source = request.validated?.body?.source;
  if (typeof source !== 'string') return next(httpError(400));
  if (!request.auth.allowed_sources.includes(source)) return next(httpError(403));
  next();
}