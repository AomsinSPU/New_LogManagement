import test from 'node:test';
import assert from 'node:assert/strict';
import { listLogsSchema } from '../src/modules/logs/logs.schema.js';
import { buildLogFilter } from '../src/modules/logs/logs.repository.js';

test('log query validates bounds, tenant injection and dates', () => {
  assert.equal(listLogsSchema.parse({}).limit, 20);
  assert.equal(listLogsSchema.parse({ severity: '0' }).severity, 0);
  for (const invalid of [{ tenant_id: 'other' }, { severity: '' }, { severity: '11' },
    { src_ip: 'invalid' }, { limit: 101 }, { offset: -1 }, { q: ' ' },
    { from: '2026-01-02T00:00:00Z', to: '2026-01-01T00:00:00Z' }]) {
    assert.equal(listLogsSchema.safeParse(invalid).success, false);
  }
});

test('log filters parameterize all user input and always scope tenant', () => {
  const attack = "' OR 1=1 --";
  const result = buildLogFilter('tenant-a', { user: attack, q: attack, severity: 0 });
  assert.ok(result.where.startsWith('tenant_id=$1'));
  assert.ok(!result.where.includes(attack));
  assert.deepEqual(result.values, ['tenant-a', attack, 0, attack]);
});