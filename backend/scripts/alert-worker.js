import { setTimeout as sleep } from 'node:timers/promises';
import { loadEnv } from '../src/config/env.js';
import { createDatabase } from '../src/db/pool.js';
import { runAlertJob } from '../src/jobs/alert-job.js';

const stop = new AbortController();
const abort = () => stop.abort();
process.once('SIGINT', abort); process.once('SIGTERM', abort);
let database;
try {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--once') || args.length > 1) throw new Error('Invalid arguments');
  const once = args.includes('--once');
  database = createDatabase(loadEnv());
  do {
    console.log('Alert evaluation:', await runAlertJob(database.pool));
    if (once || stop.signal.aborted) break;
    try { await sleep(30000, undefined, { signal: stop.signal }); } catch (error) { if (error.name !== 'AbortError') throw error; }
  } while (!stop.signal.aborted);
} catch { console.error('Alert worker failed; check database and migrations.'); process.exitCode = 1; }
finally { await database?.close(); process.removeListener('SIGINT',abort); process.removeListener('SIGTERM',abort); }