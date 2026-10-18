import { loadEnv } from './config/env.js';
import { createDatabase } from './db/pool.js';
import { createApp } from './app.js';

let database;
let server;
let shuttingDown = false;

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => {
    console.error('Shutdown deadline exceeded.');
    process.exit(1);
  }, 10000);
  deadline.unref();
  try {
    if (server?.listening) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    await database?.close();
    process.exitCode = exitCode;
  } catch {
    console.error('Unable to complete clean shutdown.');
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
  }
}

process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });

try {
  const config = loadEnv();
  database = createDatabase(config);
  await database.check();
  if (!shuttingDown) {
    const app = createApp({ config, pool: database.pool, checkDatabase: database.check, isShuttingDown: () => shuttingDown });
    await new Promise((resolve, reject) => {
      server = app.listen(config.PORT, config.HOST);
      server.once('error', reject);
      server.once('listening', resolve);
    });
    server.on('error', () => {
      console.error('HTTP server error.');
      void shutdown(1);
    });
    console.log(`Backend listening on port ${config.PORT}`);
  }
} catch (error) {
  console.error(error.message.startsWith('Invalid environment variables:')
    ? error.message : 'Backend startup failed. Check environment, database connectivity and port availability.');
  await shutdown(1);
}

