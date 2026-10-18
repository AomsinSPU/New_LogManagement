import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestSchema } from '../src/modules/ingest/ingest.schema.js';
import { normalizeCommonJson } from '../src/normalizers/common-json.js';

test('common JSON normalization preserves supplied time and infers missing time', () => {
  const base = { source: 'api', event_type: 'authentication', user: 'alice' };
  const now = new Date('2026-01-01T00:00:00Z');
  const event = normalizeCommonJson(ingestSchema.parse(base), JSON.stringify(base), now);
  assert.equal(event.event_timestamp, now.toISOString());
  assert.equal(event.actor_user, 'alice');
  assert.equal(event.outcome, 'unknown');
  assert.deepEqual(event.tags, ['timestamp_inferred']);
  const explicit = normalizeCommonJson(ingestSchema.parse({ ...base, '@timestamp': '2026-01-01T07:00:00+07:00' }), '{}', now);
  assert.equal(explicit.event_timestamp, now.toISOString());
  assert.deepEqual(explicit.tags, []);
});

test('ingest schema rejects malformed and reserved fields', () => {
  const valid = { source: 'api', event_type: 'test' };
  for (const change of [{ severity: 11 }, { src_port: 65536 }, { src_ip: '127.0.0.1/24' },
    { '@timestamp': 'yesterday' }, { tenant_id: 'other' }, { ingest_key_id: 'other' },
    { raw: 'spoof' }, { message: '\u0000' }, { metadata: { value: '\u0000' } }]) {
    assert.equal(ingestSchema.safeParse({ ...valid, ...change }).success, false);
  }
  assert.equal(ingestSchema.safeParse([valid]).success, false);
});