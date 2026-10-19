import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { runSimulator } from '../src/simulator/simulator.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const controller = new AbortController();
const stop = () => controller.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const { values } = parseArgs({ options: Object.fromEntries(
    ['transport', 'source', 'scenario', 'count', 'interval', 'url', 'host', 'port'].map(name => [name, { type: 'string' }])) });
  const result = await runSimulator({ ...values, key: process.env.SIMULATOR_INGEST_KEY }, {
    signal: controller.signal,
    report: stats => console.log(JSON.stringify(stats)),
  });
  console.log('Simulator finished:', JSON.stringify(result));
  if (result.failed) process.exitCode = 1;
  if (result.aborted) process.exitCode = 130;
} catch {
  console.error('Simulator failed: check arguments, SIMULATOR_INGEST_KEY, and endpoint. No credentials logged.');
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}