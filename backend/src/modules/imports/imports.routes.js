import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { httpError } from '../../middleware/http-error.js';
import { batchSchema, createBatchService } from '../ingest/batch.service.js';

// Upload JSON file bytes as application/json, not multipart/form-data.
export function createImportsRouter({ pool, config }) {
  const router = Router();
  router.use(authenticate({ pool }), csrfProtection(config), authorize('admin'));
  router.post('/', (request, response, next) => {
    if (!request.is('application/json')) return next(httpError(415));
    next();
  }, validate({ body: batchSchema }), async (request, response) => {
    response.status(201).json(await createBatchService(pool)(request.auth, request.validated.body));
  });
  router.get('/:id', validate({ params: z.object({ id: z.string().uuid() }) }), async (request, response) => {
    const { rows: [batch] } = await pool.query(`SELECT id,source,filename,status,total_count,
      accepted_count,rejected_count,error_summary,created_at,completed_at FROM ingestion_batches
      WHERE tenant_id=$1 AND id=$2`, [request.auth.tenant_id, request.validated.params.id]);
    if (!batch) throw httpError(404);
    response.json({ data: batch });
  });
  return router;
}