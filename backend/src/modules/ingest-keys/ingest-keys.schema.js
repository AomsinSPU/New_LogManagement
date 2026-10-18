import { z } from 'zod';

export const createKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
  allowed_sources: z.array(z.enum(['firewall', 'network', 'api', 'crowdstrike', 'aws', 'm365', 'ad']))
    .min(1).max(7).refine(values => new Set(values).size === values.length),
  expires_at: z.string().datetime({ offset: true }).refine(value => Date.parse(value) > Date.now())
    .nullable().optional(),
}).strict();

export const keyParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const listKeysSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();