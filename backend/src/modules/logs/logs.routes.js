import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { listLogsSchema, logParamsSchema } from './logs.schema.js';
import { createLogsRepository } from './logs.repository.js';
import { createLogsService } from './logs.service.js';
import { createLogsController } from './logs.controller.js';

export function createLogsRouter({ pool }) {
  const router = Router();
  const controller = createLogsController(createLogsService(createLogsRepository(pool)));
  router.use(authenticate({ pool }), authorize('admin', 'viewer'));
  router.get('/', validate({ query: listLogsSchema }), controller.list);
  router.get('/:id', validate({ params: logParamsSchema }), controller.detail);
  return router;
}