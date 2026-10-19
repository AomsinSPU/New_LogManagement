import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { api, errorText } from '../src/api/client.js'
const original = globalThis.fetch
afterEach(() => { globalThis.fetch = original; delete globalThis.window })
test('includes cookies and serializes request body without storing credentials', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/auth/login')
    assert.equal(options.credentials, 'include')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), { email: 'test@example.com' })
    return new Response(JSON.stringify({ user: { role: 'viewer' } }))
  }
  assert.deepEqual(await api('/auth/login', { method: 'POST', body: { email: 'test@example.com' } }), { user: { role: 'viewer' } })
})
test('204 does not parse JSON', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 })
  assert.equal(await api('/auth/logout', { method: 'POST' }), null)
})
test('protected 401 expires session, login 401 does not', async () => {
  let count = 0
  globalThis.window = { dispatchEvent(event) { assert.equal(event.type, 'session-expired'); count++ } }
  globalThis.fetch = async () => new Response(null, { status: 401 })
  await assert.rejects(api('/logs'), { status: 401 })
  await assert.rejects(api('/auth/login', { expire: false }), { status: 401 })
  assert.equal(count, 1)
})
test('forwards cancellation and network errors', async () => {
  const controller = new AbortController()
  globalThis.fetch = async (_, options) => { assert.equal(options.signal, controller.signal); throw new DOMException('Aborted', 'AbortError') }
  await assert.rejects(api('/logs', { signal: controller.signal }), { name: 'AbortError' })
})
test('server errors become safe Thai messages', async () => {
  globalThis.fetch = async () => new Response('private stack trace', { status: 500 })
  await assert.rejects(api('/logs'), { status: 500 })
  assert.ok(!errorText({ status: 500 }).includes('private'))
  assert.ok(errorText({ status: 429 }).includes('รอสักครู่'))
})