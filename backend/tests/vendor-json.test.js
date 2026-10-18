import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecord } from '../src/normalizers/vendor-json.js';

test('vendor mappings and common schema backward compatibility', () => {
  const parse = (source, data) => {
    const result = parseRecord({ format: 'vendor', source, data });
    assert.equal(result.success, true);
    return result.data;
  };
  const ad = parse('ad', { EventID: 4625, TargetUserName: 'alice', IpAddress: '203.0.113.10' });
  assert.equal(ad.outcome, 'failure'); assert.equal(ad.event_type, 'authentication');
  assert.equal(ad.user, 'alice'); assert.equal(ad.src_ip, '203.0.113.10');
  assert.equal(parse('ad', { EventID: 4624 }).outcome, 'success');
  const aws = parse('aws', { eventName: 'ConsoleLogin', sourceIPAddress: 'service.amazonaws.com', responseElements: { ConsoleLogin: 'Failure' } });
  assert.equal(aws.outcome, 'failure'); assert.equal(aws.src_ip, undefined);
  assert.equal(aws.metadata.original.sourceIPAddress, 'service.amazonaws.com');
  const m365 = parse('m365', { Operation: 'UserLoggedIn', CreationTime: '2026-01-01T12:00:00', ResultStatus: 'Success' });
  assert.equal(m365['@timestamp'], '2026-01-01T12:00:00Z');
  assert.equal(m365.outcome, 'success');
  assert.equal(parse('crowdstrike', { event_type: 'DetectionSummary', detection_name: 'Test', severity: 8 }).severity, 8);
  assert.ok(parseRecord({ source: 'api', event_type: 'test' }).success);
});

test('unsupported shapes, malformed time and identity injection rejected', () => {
  for (const value of [
    { format: 'vendor', source: 'ad', data: { EventID: 9999 } },
    { format: 'vendor', source: 'aws', data: { eventName: 'Test', eventTime: 'bad' } },
    { format: 'vendor', source: 'm365', data: { Operation: 'Test', CreationTime: 'bad' } },
    { format: 'vendor', source: 'ad', data: { EventID: 4625, tenant_id: 'other' } },
    { format: 'vendor', source: 'api', data: {} }, null,
  ]) assert.equal(parseRecord(value).success, false);
});