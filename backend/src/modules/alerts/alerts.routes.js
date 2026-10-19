import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import { ruleSchema, patchRuleSchema, idSchema, pageSchema, listAlertsSchema, statusSchema } from './alerts.schema.js';
import { createAlertsRepository } from './alerts.repository.js';

export function createAlertsRouters({ pool, config }) {
  const rules = Router(), alerts = Router();
  const repository = createAlertsRepository(pool);
  for (const router of [rules, alerts]) router.use(authenticate({ pool }), authorize('admin','viewer'), csrfProtection(config),
    (req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  rules.get('/', validate({ query: pageSchema }), async (req,res) => res.json(await repository.list(req.auth.tenant_id,req.validated.query,true)));
  rules.post('/', authorize('admin'), validate({ body: ruleSchema }), async (req,res) => res.status(201).json({ data: await repository.create(req.auth,req.validated.body) }));
  rules.patch('/:id', authorize('admin'), validate({ params: idSchema, body: patchRuleSchema }),
    async (req,res) => res.json({ data: await repository.patchRule(req.auth.tenant_id,req.validated.params.id,req.validated.body) }));
  alerts.get('/', validate({ query: listAlertsSchema }), async (req,res) => res.json(await repository.list(req.auth.tenant_id,req.validated.query)));
  alerts.get('/:id', validate({ params: idSchema }), async (req,res) => res.json({ data: await repository.detail(req.auth.tenant_id,req.validated.params.id) }));
  alerts.patch('/:id', authorize('admin'), validate({ params: idSchema, body: statusSchema }),
    async (req,res) => res.json({ data: await repository.status(req.auth,req.validated.params.id,req.validated.body.status) }));
  return { rules, alerts };
}