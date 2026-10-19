import { loadEnv } from '../src/config/env.js';
import { createDatabase } from '../src/db/pool.js';
import { runRetentionJob } from '../src/jobs/retention-job.js';
let database;
try {
  const args=process.argv.slice(2);
  if(args.length>1||args.some(v=>v!=='--apply'))throw new Error();
  database=createDatabase(loadEnv());
  console.log(JSON.stringify(await runRetentionJob(database.pool,{dryRun:!args.includes('--apply')})));
} catch {console.error('Retention failed; check database configuration. Earlier batches may have committed.');process.exitCode=1;}
finally {await database?.close();}