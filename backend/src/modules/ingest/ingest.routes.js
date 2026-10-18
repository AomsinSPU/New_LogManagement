import { Router } from 'express';
import { authenticateIngest, authorizeSource } from '../../middleware/ingest-auth.js';
import { validate } from '../../middleware/validate.js';
import { httpError } from '../../middleware/http-error.js';
import { ingestSchema } from './ingest.schema.js';
import { createIngestRepository } from './ingest.repository.js';
import { createIngestService } from './ingest.service.js';
import { createIngestController } from './ingest.controller.js';

export function createIngestRouter({ pool }) {
  const router = Router();
  router.post('/', (request, response, next) => {
    if (!request.is('application/json')) return next(httpError(415));
    next();
  }, authenticateIngest({ pool }), validate({ body: ingestSchema }), authorizeSource,
  createIngestController(createIngestService(createIngestRepository(pool))));
  return router;
}