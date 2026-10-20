import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_BYTES, parseImport } from '../src/features/imports/validation.js'
const input = overrides => JSON.stringify({ source: 'api', records: [{ source: 'api', event_type: 'authentication' }], ...overrides })
test('parses envelope and fills local filename without altering records', () => {
  const result = parseImport('\uFEFF' + input(), 'sample.json')
  assert.equal(result.body.filename, 'sample.json')
  assert.equal(result.body.records[0].event_type, 'authentication')
  assert.equal(result.bytes, new TextEncoder().encode(JSON.stringify(result.body)).length)
  assert.equal(parseImport(input({ filename: ' original.json ' }), 'other.json').body.filename, 'original.json')
})
test('rejects invalid JSON, arrays, unsupported source and extra fields', () => {
  for (const text of ['{', '[]', 'null', input({ source: 'toString' }), input({ tenant_id: 'other' }), input({ source: 'unknown' })]) assert.throws(() => parseImport(text, 'test.json'))
})
test('bounds records while leaving per-record validation to backend', () => {
  assert.throws(() => parseImport(input({ records: [] }), 'test.json'))
  assert.throws(() => parseImport(input({ records: Array(501).fill({}) }), 'test.json'))
  assert.equal(parseImport(input({ records: Array(500).fill(null) }), 'test.json').body.records.length, 500)
})
test('rejects unsafe filenames and counts UTF-8 bytes', () => {
  for (const filename of ['', 'x\ny', 'a'.repeat(256), null]) assert.throws(() => parseImport(input({ filename }), 'test.json'))
  assert.throws(() => parseImport(input({ records: ['ก'.repeat(MAX_BYTES / 2)] }), 'test.json'))
  const base = input({ records: [''] })
  const nearLimit = input({ records: ['a'.repeat(MAX_BYTES - base.length)] })
  assert.equal(new TextEncoder().encode(nearLimit).length, MAX_BYTES)
  assert.throws(() => parseImport(nearLimit, 'additional-filename.json'))
})