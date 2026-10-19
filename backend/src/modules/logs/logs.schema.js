import { z } from 'zod';
import { isIP } from 'node:net';

const text = z.string().trim().min(1).max(255).refine(value => !value.includes('\u0000'));
export const logFilterShape = {
  batch_id: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  source: z.enum(['api', 'ad', 'aws', 'm365', 'crowdstrike', 'firewall', 'network']).optional(),
  src_ip: z.string().refine(value => isIP(value) !== 0).optional(),
  dst_ip: z.string().refine(value => isIP(value) !== 0).optional(),
  user: text.optional(), event_type: text.optional(),
  outcome: z.enum(['success', 'failure', 'unknown']).optional(),
  severity: z.string().regex(/^(?:[0-9]|10)$/).transform(Number).optional(),
  q: text.optional(),
};
export const listLogsSchema = z.object({
  ...logFilterShape,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict().refine(value => !value.from || !value.to || Date.parse(value.from) < Date.parse(value.to));

export const logParamsSchema = z.object({ id: z.string().uuid() }).strict();