import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { httpError } from '../../middleware/http-error.js';
import { batchSchema, createBatchService } from '../ingest/batch.service.js';
import { pageSchema } from '../alerts/alerts.schema.js';
const listImportsSchema = pageSchema.extend({
  source: batchSchema.shape.source.optional(),
  status: z.enum(['processing','completed','partial','failed']).optional(),
});

// Upload JSON file bytes as application/json, not multipart/form-data.
export function createImportsRouter({ pool, config }) {
  const router = Router();
  router.use(authenticate({ pool }), csrfProtection(config), authorize('admin'));
  router.get('/', validate({ query: listImportsSchema }), async (request,response) => {
    const filter=request.validated.query, values=[request.auth.tenant_id];
    let where='tenant_id=$1';
    for (const field of ['source','status']) if (filter[field]) {
      values.push(filter[field]); where+=` AND ${field}=$${values.length}`;
    }
    values.push(filter.limit+1,filter.offset);
    const {rows}=await pool.query(`SELECT id,source,filename,status,total_count,accepted_count,rejected_count,
      created_at,completed_at,ingest_key_id,submitted_by FROM ingestion_batches WHERE ${where}
      ORDER BY created_at DESC,id DESC LIMIT $${values.length-1} OFFSET $${values.length}`,values);
    response.json({data:rows.slice(0,filter.limit),pagination:{limit:filter.limit,offset:filter.offset,has_more:rows.length>filter.limit}});
  });
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