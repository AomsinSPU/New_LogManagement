import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allowedTransitions, ruleBody } from '../src/features/alerts/helpers.js'
const valid = { name: 'Failed login', threshold: '5', window_seconds: '300', cooldown_seconds: '0', severity: '0', is_enabled: 'on' }
const form = values => new Map(Object.entries({ ...valid, ...values }))
test('only admin can acknowledge or resolve and resolved cannot reopen', () => {
  assert.deepEqual(allowedTransitions('admin', 'open'), ['acknowledged', 'resolved'])
  assert.deepEqual(allowedTransitions('admin', 'acknowledged'), ['resolved'])
  for (const role of ['viewer', 'admin', 'unknown']) assert.deepEqual(allowedTransitions(role, 'resolved'), [])
  assert.deepEqual(allowedTransitions('viewer', 'open'), [])
})
test('create uses only supported rule type and preserves zero values', () => {
  const body = ruleBody(form())
  assert.equal(body.rule_type, 'failed_login_threshold'); assert.equal(body.cooldown_seconds, 0)
  assert.equal(body.severity, 0); assert.equal(body.is_enabled, true); assert.equal(body.threshold, 5)
  assert.equal('description' in body, false)
})
test('patch sends changed fields only and supports disabling', () => {
  const original = ruleBody(form())
  assert.deepEqual(ruleBody(form(), original), {})
  assert.deepEqual(ruleBody(form({ is_enabled: '', threshold: '8' }), original), { is_enabled: false, threshold: 8 })
})
test('validation rejects empty, fractional, out of bounds and unsupported description clearing', () => {
  for (const value of [{ name: '' }, { threshold: '1.5' }, { threshold: '' }, { threshold: '100001' }, { window_seconds: '0' }, { window_seconds: '86401' }, { cooldown_seconds: '-1' }, { cooldown_seconds: '604801' }, { severity: '11' }, { severity: 'NaN' }]) assert.throws(() => ruleBody(form(value)))
  assert.throws(() => ruleBody(form(), { ...ruleBody(form()), description: 'Existing description' }))
})