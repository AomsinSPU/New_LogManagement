import test from 'node:test';
import assert from 'node:assert/strict';
import { batchSchema, createBatchService } from '../src/modules/ingest/batch.service.js';

test('batch envelope limits and reserved fields', () => {
  assert.ok(batchSchema.safeParse({ source: 'api', records: [null] }).success);
  for (const input of [{ source: 'api', records: [] },
    { source: 'api', records: Array(501).fill(null) },
    { source: 'api', records: [{}], tenant_id: 'fake' }]) {
    assert.equal(batchSchema.safeParse(input).success, false);
  }
});

test('batch rolls back unexpected storage errors rather than reporting success', async () => {
  const calls = [];
  let released = false;
  const client = { async query(sql) {
    calls.push(sql);
    if (sql.startsWith('INSERT INTO ingestion_batches')) return { rows: [{ id: 'batch' }] };
    if (sql.includes('INSERT INTO public.logs')) throw new Error('storage failure');
    return { rows: [] };
  }, release() { released = true; } };
  const service = createBatchService({ async connect() { return client; } });
  await assert.rejects(service({ type: 'session', tenant_id: 'a', user_id: 'u' }, {
    source: 'api', records: [{ source: 'api', event_type: 'test' }],
  }), /storage failure/);
  assert.ok(calls.includes('ROLLBACK'));
  assert.ok(!calls.includes('COMMIT'));
  assert.ok(released);
});