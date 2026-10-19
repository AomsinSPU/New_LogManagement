import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDate, toApiTime, toThaiInput } from '../src/utils/format.js'
test('Thai input is Bangkok time regardless of browser timezone', () => {
  assert.equal(toApiTime('2026-10-19T10:00'), '2026-10-19T03:00:00.000Z')
  assert.equal(toThaiInput('2026-10-19T03:00:00Z'), '2026-10-19T10:00')
})
test('dates use Gregorian year and Bangkok timezone across midnight', () => {
  const text = formatDate('2026-10-18T18:00:00Z')
  assert.match(text, /2026/); assert.match(text, /19/); assert.match(text, /01:00:00/)
  assert.ok(!text.includes('2569'))
})
test('missing and invalid dates are handled', () => {
  assert.equal(formatDate(null), '—'); assert.equal(formatDate('invalid'), '—')
  assert.equal(toThaiInput('invalid'), ''); assert.equal(toApiTime(''), '')
})