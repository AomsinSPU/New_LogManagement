import test from 'node:test';
import assert from 'node:assert/strict';
import { summarySchema, timelineSchema } from '../src/modules/dashboard/dashboard.schema.js';
import { createDashboardService } from '../src/modules/dashboard/dashboard.service.js';

test('dashboard defaults, shared filters and bounded timelines', () => {
  const defaults = summarySchema.parse({});
  assert.equal(Date.parse(defaults.to) - Date.parse(defaults.from), 86400000);
  assert.equal(summarySchema.parse({ severity: '0' }).severity, 0);
  assert.equal(timelineSchema.safeParse({ interval: 'minute' }).success, false);
  for (const query of [{ top: 21 }, { tenant_id: 'other' }, { limit: 10 },
    { from: '2026-01-02T00:00:00Z', to: '2026-01-01T00:00:00Z' },
    { from: '2026-01-01T00:00:00Z', to: '2026-05-01T00:00:00Z' }]) {
    assert.equal(summarySchema.safeParse(query).success, false);
  }
  assert.equal(timelineSchema.safeParse({ from: '2026-01-01T00:00:00Z', to: '2026-01-01T01:00:00Z', interval: 'minute' }).success, true);
});

test('dashboard service takes tenant from authenticated identity', async () => {
  const calls = [];
  const repository = { summary: async (...args) => { calls.push(args); return { total: 0 }; },
    timeline: async (...args) => { calls.push(args); return []; } };
  const service = createDashboardService(repository);
  const filter = summarySchema.parse({});
  assert.equal((await service.summary({ tenant_id: 'verified' }, filter)).data.total, 0);
  await service.timeline({ tenant_id: 'verified' }, filter);
  assert.ok(calls.every(([tenant]) => tenant === 'verified'));
});