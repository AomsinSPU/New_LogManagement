import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { startSyslogCollector } from '../src/collectors/syslog.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
try {
  const collector = await startSyslogCollector({
    host: process.env.SYSLOG_HOST ?? '127.0.0.1', port: Number(process.env.SYSLOG_PORT ?? 5514),
    source: process.env.SYSLOG_SOURCE ?? 'firewall',
    allowedSenders: (process.env.SYSLOG_ALLOWED_SENDERS ?? '127.0.0.1').split(',').map(s => s.trim()).filter(Boolean),
    url: process.env.SYSLOG_INGEST_URL ?? 'http://localhost:3000/ingest',
    key: process.env.SYSLOG_INGEST_KEY,
    report: code => { if (code !== 'forwarded') console.error(`Syslog: ${code}`); },
  });
  console.log(`Syslog UDP listening on ${collector.address.address}:${collector.address.port}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
    await collector.close();
    console.log('Syslog stopped', collector.stats);
  });
} catch {
  console.error('Cannot start Syslog collector: check configuration and UDP port.');
  process.exitCode = 1;
}