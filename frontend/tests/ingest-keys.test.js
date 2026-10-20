import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createKeyBody, keyStatus } from '../src/features/ingest-keys/helpers.js'
const now = Date.parse('2026-10-19T03:00:00Z')
function form(name = 'Test', sources = ['api'], expiry = '') {
  const data = new FormData(); data.set('name', name); data.set('expires_at', expiry)
  for (const source of sources) data.append('allowed_sources', source)
  return data
}
test('creation serializes only supported fields and explicit no-expiry', () => {
  assert.deepEqual(createKeyBody(form(' Test ', ['api', 'aws']), now), { name: 'Test', allowed_sources: ['api', 'aws'], expires_at: null })
})
test('expiry is future Bangkok time, not local machine time', () => {
  assert.equal(createKeyBody(form('Test', ['api'], '2026-10-20T10:00'), now).expires_at, '2026-10-20T03:00:00.000Z')
  for (const expiry of ['2026-10-19T10:00', '2026-10-18T10:00', 'invalid']) assert.throws(() => createKeyBody(form('Test', ['api'], expiry), now))
})
test('rejects blank/long names and absent/duplicate/unknown sources', () => {
  for (const data of [form(''), form('a'.repeat(101)), form('Test', []), form('Test', ['api', 'api']), form('Test', ['toString'])]) assert.throws(() => createKeyBody(data, now))
})
test('revocation takes precedence over expiry and expired boundary is inclusive', () => {
  assert.equal(keyStatus({ revoked_at: '2026-01-01', expires_at: '2026-01-01' }, now), 'เพิกถอนแล้ว')
  assert.equal(keyStatus({ expires_at: new Date(now).toISOString() }, now), 'หมดอายุแล้ว')
  assert.equal(keyStatus({ expires_at: null }, now), 'ยังไม่หมดอายุ/ไม่ถูกเพิกถอน')
})