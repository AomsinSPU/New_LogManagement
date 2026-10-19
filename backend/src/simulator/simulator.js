import dgram from 'node:dgram';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { isIP } from 'node:net';
import { ingestSchema } from '../modules/ingest/ingest.schema.js';

export const simulatorSchema = z.object({
  transport: z.enum(['http', 'udp']).default('http'),
  source: z.enum(['api', 'ad', 'aws', 'm365', 'crowdstrike', 'firewall', 'network']).default('api'),
  scenario: z.enum(['mixed', 'failed-login']).default('mixed'),
  count: z.coerce.number().int().min(1).max(10000).default(20),
  interval: z.coerce.number().int().min(10).max(60000).default(1000),
  url: z.string().default('http://localhost:3000/ingest'),
  key: z.string().optional(),
  host: z.string().refine(value => isIP(value) === 4).optional(),
  port: z.coerce.number().int().min(1).max(65535).default(5514),
}).strict().superRefine((v, ctx) => {
  if (v.transport === 'http') {
    try {
      const url = new URL(v.url);
      if (url.username || url.password || url.search || url.hash ||
        !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error();
    } catch { ctx.addIssue({ code: 'custom', message: 'Use HTTPS or loopback HTTP without credentials', path: ['url'] }); }
    if (!v.key || /\s/.test(v.key)) ctx.addIssue({ code: 'custom', message: 'Missing or invalid ingest key', path: ['key'] });
  }
  if (v.transport === 'udp' && (!['firewall', 'network'].includes(v.source) || v.scenario !== 'mixed')) {
    ctx.addIssue({ code: 'custom', message: 'UDP requires firewall/network and mixed scenario' });
  }
  if (v.scenario === 'failed-login' && !['api', 'ad', 'aws', 'm365'].includes(v.source)) {
    ctx.addIssue({ code: 'custom', message: 'Failed login requires an authentication source' });
  }
});

export function createSimulatedEvent({ source, scenario }, index, runId, now = new Date()) {
  const network = ['firewall', 'network'].includes(source);
  const threat = source === 'crowdstrike';
  const failed = scenario === 'failed-login' || index % 3 === 0;
  return ingestSchema.parse({
    source, '@timestamp': now.toISOString(),
    event_type: network ? 'network_connection' : threat ? 'threat_detection' : 'authentication',
    event_subtype: network ? 'connection' : threat ? 'synthetic_detection' : failed ? 'login_failed' : 'login_success',
    action: network ? (failed ? 'deny' : 'allow') : threat ? 'alert' : 'login',
    outcome: network || threat ? 'unknown' : failed ? 'failure' : 'success',
    severity: threat ? 8 : failed ? 5 : 1,
    src_ip: scenario === 'failed-login' ? '203.0.113.10' : `203.0.113.${10 + index % 5}`,
    user: scenario === 'failed-login' ? 'simulated-alice' : `simulated-user-${index % 3}`,
    host: 'simulator', message: `Synthetic ${source} ${network ? 'connection' : threat ? 'detection' : failed ? 'login failed' : 'login succeeded'}`,
    source_event_id: `${runId}:${index}`, tags: ['simulator'],
    metadata: { synthetic: true, run_id: runId, sequence: index },
    ...(network ? { dst_ip: '192.0.2.20', dst_port: 443, protocol: 'TCP' } : {}),
  });
}

export function createSimulatedSyslog(event) {
  return `<134>1 ${event['@timestamp']} simulator demo - CONNECTION - action=${event.action} src_ip=${event.src_ip} dst_ip=${event.dst_ip} dst_port=${event.dst_port} protocol=TCP user=${event.user} simulator_run=${event.metadata.run_id} sequence=${event.metadata.sequence}`;
}

export async function runSimulator(options, { signal, report = () => {} } = {}) {
  const config = simulatorSchema.parse(options);
  const runId = randomUUID();
  const summary = { run_id: runId, transport: config.transport, attempted: 0, accepted: 0, sent: 0, failed: 0, aborted: false };
  const socket = config.transport === 'udp' ? dgram.createSocket('udp4') : null;
  // send callbacks report local errors; keep an error listener to avoid uncaught socket errors.
  socket?.on('error', () => {});
  try {
    for (let i = 0; i < config.count; i++) {
      if (signal?.aborted) break;
      const event = createSimulatedEvent(config, i, runId);
      summary.attempted++;
      let terminal = false;
      try {
        if (socket) {
          await new Promise((resolve, reject) => socket.send(createSimulatedSyslog(event), config.port,
            config.host ?? '127.0.0.1', error => error ? reject(error) : resolve()));
          summary.sent++;
        } else {
          const response = await fetch(config.url, { method: 'POST', redirect: 'error',
            headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(event), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
          await response.body?.cancel();
          if (response.status === 201) summary.accepted++;
          else { summary.failed++; terminal = [400, 401, 403, 404, 413, 415, 422, 429].includes(response.status); }
        }
      } catch { summary.failed++; }
      report({ ...summary });
      if (terminal || signal?.aborted) break;
      if (i + 1 < config.count) {
        try { await sleep(config.interval, undefined, { signal }); }
        catch (error) { if (error.name !== 'AbortError') throw error; break; }
      }
    }
  } finally {
    if (socket) await new Promise(resolve => { try { socket.close(resolve); } catch { resolve(); } });
  }
  summary.aborted = Boolean(signal?.aborted);
  return summary;
}