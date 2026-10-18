import express from 'express';
import { createCors } from './middleware/cors.js';
import { security } from './middleware/security.js';
import { bodyParser, cookies } from './middleware/body-parser.js';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createIngestKeysRouter } from './modules/ingest-keys/ingest-keys.routes.js';
import { createIngestRouter } from './modules/ingest/ingest.routes.js';
import { createLogsRouter } from './modules/logs/logs.routes.js';
import { createImportsRouter } from './modules/imports/imports.routes.js';

export function createApp({ config, checkDatabase, pool, isShuttingDown = () => false }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(security);
  app.use(createCors(config));
  app.use(bodyParser);
  app.use(cookies);

  app.get('/health', (request, response) => {
    response.set('Cache-Control', 'no-store').json({ status: 'ok' });
  });
  app.get('/ready', async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (isShuttingDown()) return response.status(503).json({ status: 'not_ready' });
    try {
      await checkDatabase();
      response.json({ status: 'ready' });
    } catch {
      response.status(503).json({ status: 'not_ready' });
    }
  });
  if (pool) app.use('/auth', createAuthRouter({ pool, config }));
  if (pool) app.use('/ingest-keys', createIngestKeysRouter({ pool, config }));
  if (pool) app.use('/ingest', createIngestRouter({ pool }));
  if (pool) app.use('/logs', createLogsRouter({ pool }));
  if (pool) app.use('/imports', createImportsRouter({ pool, config }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
