import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dashboardFilters, defaultRange, logsLink } from '../src/features/dashboard/filters.js'

test('default range is exactly 24h with minute precision', () => {
  const range = defaultRange(Date.parse('2026-10-19T12:30:59.123Z'))
  assert.deepEqual(range, { from: '2026-10-18T12:30:00.000Z', to: '2026-10-19T12:30:00.000Z' })
})
test('summary, timeline and drilldown share exact bounds and tenant-safe filters', () => {
  const { filters, interval } = dashboardFilters('source=aws&batch_id=batch&severity=0&tenant_id=other&offset=100', defaultRange())
  assert.equal(interval, 'hour'); assert.equal(filters.get('severity'), '0')
  assert.equal(filters.has('tenant_id'), false); assert.equal(filters.has('offset'), false)
  const link = new URLSearchParams(logsLink(filters, { src_ip: '10.0.0.1' }).split('?')[1])
  for (const key of ['from', 'to', 'source', 'batch_id']) assert.equal(link.get(key), filters.get(key))
  assert.equal(link.get('src_ip'), '10.0.0.1')
})
test('ranges are positive, finite and bounded to 90 days', () => {
  for (const to of ['invalid', '2026-01-01T00:00:00Z', '2025-12-31T00:00:00Z', '2026-05-01T00:00:00Z']) {
    assert.throws(() => dashboardFilters(`from=2026-01-01T00:00:00Z&to=${to}`, {}))
  }
})
test('automatic interval stays within the backend 1000-bucket ceiling', () => {
  for (const hours of [1, 12, 13, 24, 720, 721, 2160]) {
    const from = '2026-01-01T00:00:00Z', to = new Date(Date.parse(from) + hours * 3600000).toISOString()
    const { interval } = dashboardFilters(new URLSearchParams({ from, to }).toString(), {})
    assert.ok(Math.ceil(hours * 3600 / { minute: 60, hour: 3600, day: 86400 }[interval]) <= 1000)
  }
})
test('timeline drilldown replaces range while retaining source and batch', () => {
  const link = logsLink(new URLSearchParams({ source: 'aws', batch_id: 'example', from: 'old', to: 'old' }), { from: 'start', to: 'end' })
  const params = new URLSearchParams(link.split('?')[1])
  assert.equal(params.get('from'), 'start'); assert.equal(params.get('to'), 'end')
  assert.equal(params.get('source'), 'aws'); assert.equal(params.get('batch_id'), 'example')
})