import { randomBytes, createHash } from 'node:crypto';
import { httpError } from '../../middleware/http-error.js';

export function createKeyService(repository) {
  return {
    async create(auth, input) {
      const secret = randomBytes(32).toString('hex');
      const key = await repository.create({
        tenantId: auth.tenant_id, userId: auth.user_id, name: input.name,
        hash: createHash('sha256').update(secret).digest('hex'), prefix: secret.slice(0, 8),
        sources: input.allowed_sources, expiresAt: input.expires_at ?? null,
      });
      if (!key) throw httpError(400);
      return { key, secret };
    },
    async list(auth, { limit, offset }) {
      const rows = await repository.list(auth.tenant_id, limit + 1, offset);
      return { data: rows.slice(0, limit), pagination: { limit, offset, has_more: rows.length > limit } };
    },
    async revoke(auth, id) {
      if (!await repository.revoke(auth.tenant_id, id)) throw httpError(404);
    },
  };
}