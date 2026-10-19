import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleSchema, patchRuleSchema, statusSchema } from '../src/modules/alerts/alerts.schema.js';
test('alert validation rejects unsafe fields and preserves sparse patches', () => {
  assert.equal(ruleSchema.parse({ name: 'Test' }).threshold, 5);
  assert.deepEqual(patchRuleSchema.parse({ is_enabled: false }), { is_enabled: false });
  for (const input of [{}, { threshold: 0 }, { window_seconds: 86401 }, { tenant_id: 'other' }]) {
    assert.equal(patchRuleSchema.safeParse(input).success, false);
  }
  assert.equal(statusSchema.safeParse({ status: 'open' }).success, false);
});