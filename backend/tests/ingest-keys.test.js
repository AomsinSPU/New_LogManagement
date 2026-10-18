import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createKeySchema, listKeysSchema } from '../src/modules/ingest-keys/ingest-keys.schema.js';
import { createKeyService } from '../src/modules/ingest-keys/ingest-keys.service.js';

test('key schema rejects invalid sources, tenant injection and past expiry', () => {
  const valid = { name: 'API', allowed_sources: ['api'] };
  assert.ok(createKeySchema.safeParse(valid).success);
  for (const input of [{ ...valid, tenant_id: 'other' }, { ...valid, allowed_sources: [] },
    { ...valid, allowed_sources: ['api', 'api'] }, { ...valid, allowed_sources: ['invalid'] },
    { ...valid, expires_at: '2000-01-01T00:00:00Z' }, { ...valid, name: ' ' }]) {
    assert.equal(createKeySchema.safeParse(input).success, false);
  }
  assert.equal(listKeysSchema.safeParse({ limit: 101 }).success, false);
});

test('service stores only hash and uses authenticated tenant', async () => {
  let stored;
  const service = createKeyService({
    async create(input) { stored = input; return { id: 'test' }; },
    async revoke(tenant, id) { assert.equal(tenant, 'tenant-a'); return undefined; },
  });
  const result = await service.create({ tenant_id: 'tenant-a', user_id: 'admin-a' },
    { name: 'API', allowed_sources: ['api'] });
  assert.match(result.secret, /^[a-f0-9]{64}$/);
  assert.equal(stored.hash, createHash('sha256').update(result.secret).digest('hex'));
  assert.equal(stored.tenantId, 'tenant-a');
  assert.ok(!JSON.stringify(stored).includes(result.secret));
  await assert.rejects(service.revoke({ tenant_id: 'tenant-a' }, 'missing'), error => error.status === 404);
});