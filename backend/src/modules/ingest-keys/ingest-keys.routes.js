import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { createKeySchema, keyParamsSchema, listKeysSchema } from './ingest-keys.schema.js';
import { createKeyRepository } from './ingest-keys.repository.js';
import { createKeyService } from './ingest-keys.service.js';
import { createKeyController } from './ingest-keys.controller.js';

export function createIngestKeysRouter({ pool, config }) {
  const router = Router();
  const controller = createKeyController(createKeyService(createKeyRepository(pool)));
  router.use(authenticate({ pool }), csrfProtection(config), authorize('admin'));
  router.get('/', validate({ query: listKeysSchema }), controller.list);
  router.post('/', validate({ body: createKeySchema }), controller.create);
  router.delete('/:id', validate({ params: keyParamsSchema }), controller.revoke);
  return router;
}