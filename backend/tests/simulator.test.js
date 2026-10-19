import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createSimulatedEvent, runSimulator, simulatorSchema } from '../src/simulator/simulator.js';
import { startSyslogCollector } from '../src/collectors/syslog.js';

test('simulator validates bounds and generates synthetic common-schema events', () => {
  for (const source of ['api','ad','aws','m365','crowdstrike','firewall','network']) {
    assert.equal(createSimulatedEvent({ source, scenario: 'mixed' }, 0, 'test').source, source);
  }
  const events = [0,1,2,3,4].map(i => createSimulatedEvent({ source: 'api', scenario: 'failed-login' }, i, 'test'));
  assert.ok(events.every(e => e.outcome === 'failure' && e.src_ip === '203.0.113.10'));
  assert.equal(new Set(events.map(e => e.source_event_id)).size, 5);
  for (const input of [{ count: 0 }, { interval: 0 }, { url: 'http://example.com/ingest' },
    { url: 'https://user:pass@example.com' }, { transport: 'udp', source: 'api' },
    { source: 'firewall', scenario: 'failed-login' }]) {
    assert.equal(simulatorSchema.safeParse({ key: 'test', ...input }).success, false);
  }
});

test('simulator sends HTTP, stops on denied key, supports cancellation and forwards UDP through collector', async () => {
  const received = [];
  let status = 201;
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received.push({ auth: req.headers.authorization, event: JSON.parse(Buffer.concat(chunks)) });
    res.writeHead(status).end();
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/ingest`;
  let collector;
  try {
    const options = { key: 'test-secret', url, interval: 10, count: 5, scenario: 'failed-login' };
    const result = await runSimulator(options);
    assert.equal(result.accepted, 5);
    assert.equal(result.failed, 0);
    assert.ok(received.every(r => r.auth === 'Bearer test-secret' && r.event.outcome === 'failure'));
    status = 403;
    const denied = await runSimulator(options);
    assert.equal(denied.attempted, 1); assert.equal(denied.failed, 1);
    status = 201;
    const controller = new AbortController();
    const cancelled = await runSimulator(options, { signal: controller.signal, report: () => controller.abort() });
    assert.equal(cancelled.attempted, 1); assert.equal(cancelled.aborted, true);
    collector = await startSyslogCollector({ port: 0, url, key: 'collector-key' });
    const udp = await runSimulator({ transport: 'udp', source: 'firewall', count: 2, interval: 10, port: collector.address.port });
    assert.equal(udp.sent, 2); assert.equal(udp.accepted, 0);
    for (let i = 0; i < 200 && collector.stats.forwarded < 2; i++) await new Promise(r => setTimeout(r, 10));
    assert.equal(collector.stats.forwarded, 2);
    assert.equal(received.at(-1).event.source, 'firewall');
  } finally { await collector?.close(); await new Promise(resolve => server.close(resolve)); }
});