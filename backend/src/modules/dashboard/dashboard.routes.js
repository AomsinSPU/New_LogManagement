import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { summarySchema, timelineSchema } from './dashboard.schema.js';
import { createDashboardRepository } from './dashboard.repository.js';
import { createDashboardService } from './dashboard.service.js';
import { createDashboardController } from './dashboard.controller.js';

export function createDashboardRouter({ pool }) {
  const router = Router();
  const controller = createDashboardController(createDashboardService(createDashboardRepository(pool)));
  router.use(authenticate({ pool }), authorize('admin', 'viewer'));
  router.get('/summary', validate({ query: summarySchema }), controller.summary);
  router.get('/timeline', validate({ query: timelineSchema }), controller.timeline);
  return router;
}