import { z } from 'zod';
const text = z.string().trim().min(1).max(255).refine(v => !v.includes('\u0000'));
export const ruleSchema = z.object({ name: text, description: text.optional(),
  rule_type: z.literal('failed_login_threshold').default('failed_login_threshold'),
  threshold: z.number().int().min(1).max(100000).default(5),
  window_seconds: z.number().int().min(1).max(86400).default(300),
  cooldown_seconds: z.number().int().min(0).max(604800).default(300),
  severity: z.number().int().min(0).max(10).default(5), is_enabled: z.boolean().default(true),
}).strict();
export const patchRuleSchema = z.object({ name: text.optional(), description: text.optional(),
  threshold: z.number().int().min(1).max(100000).optional(),
  window_seconds: z.number().int().min(1).max(86400).optional(),
  cooldown_seconds: z.number().int().min(0).max(604800).optional(),
  severity: z.number().int().min(0).max(10).optional(), is_enabled: z.boolean().optional(),
}).strict().refine(v => Object.keys(v).length > 0);
export const idSchema = z.object({ id: z.string().uuid() }).strict();
export const pageSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict();
export const listAlertsSchema = pageSchema.extend({ status: z.enum(['open','acknowledged','resolved']).optional() });
export const statusSchema = z.object({ status: z.enum(['acknowledged','resolved']) }).strict();