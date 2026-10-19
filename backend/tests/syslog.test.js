import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import dgram from 'node:dgram';
import { once } from 'node:events';
import { parseSyslog } from '../src/normalizers/syslog.js';
import { startSyslogCollector } from '../src/collectors/syslog.js';

const sample = '<134>1 - fw01 demo - CONNECTION - action=deny src_ip=203.0.113.10 dst_port=443 protocol=TCP';
test('syslog subset maps fields and rejects unsupported or unsafe input', () => {
  const value = parseSyslog(sample);
  assert.equal(value.src_ip, '203.0.113.10');
  assert.equal(value.dst_port, 443);
  assert.equal(value.severity, 1);
  assert.equal(value.metadata.syslog.raw, sample);
  assert.equal(parseSyslog(sample, 'network').source, 'network');
  for (const raw of ['invalid', sample.replace('<134>', '<192>'), sample + '\n',
    sample + ' src_ip=bad', sample.replace('443', '99999'), sample.replace(' - fw01', ' bad fw01'),
    sample.replace('CONNECTION -', 'CONNECTION [x a="b"]')]) assert.throws(() => parseSyslog(raw));
});

test('UDP collector forwards valid events and records rejection and HTTP failure', async () => {
  const received = [];
  let status = 201;
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received.push({ auth: req.headers.authorization, body: JSON.parse(Buffer.concat(chunks)) });
    res.writeHead(status).end();
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const collector = await startSyslogCollector({ port: 0, url: `http://127.0.0.1:${server.address().port}/ingest`, key: 'test-key' });
  const sender = dgram.createSocket('udp4');
  const send = raw => new Promise((resolve, reject) => sender.send(raw, collector.address.port, '127.0.0.1', e => e ? reject(e) : resolve()));
  const wait = async fn => { for (let i = 0; i < 200; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 10)); } assert.fail('Timeout'); };
  try {
    await send(sample); await wait(() => collector.stats.forwarded === 1);
    assert.equal(received[0].auth, 'Bearer test-key');
    assert.equal(received[0].body.metadata.syslog.raw, sample);
    await send('invalid'); await wait(() => collector.stats.rejected === 1);
    status = 403; await send(sample); await wait(() => collector.stats.failed === 1);
  } finally { sender.close(); await collector.close(); await new Promise(r => server.close(r)); }
});