import { Router } from 'express';
import { authenticateIngest, authorizeSource } from '../../middleware/ingest-auth.js';
import { validate } from '../../middleware/validate.js';
import { httpError } from '../../middleware/http-error.js';
import { incomingRecordSchema } from '../../normalizers/vendor-json.js';
import { createIngestRepository } from './ingest.repository.js';
import { createIngestService } from './ingest.service.js';
import { createIngestController } from './ingest.controller.js';
import { batchSchema, createBatchService } from './batch.service.js';

export function createIngestRouter({ pool }) {
  const router = Router();
  router.post('/batch', (request, response, next) => {
    if (!request.is('application/json')) return next(httpError(415));
    next();
  }, authenticateIngest({ pool }), validate({ body: batchSchema }), authorizeSource,
  async (request, response) => {
    response.set('Cache-Control', 'no-store').status(201)
      .json(await createBatchService(pool)(request.auth, request.validated.body));
  });
  router.post('/', (request, response, next) => {
    if (!request.is('application/json')) return next(httpError(415));
    next();
  }, authenticateIngest({ pool }), validate({ body: incomingRecordSchema }), authorizeSource,
  createIngestController(createIngestService(createIngestRepository(pool))));
  return router;
}