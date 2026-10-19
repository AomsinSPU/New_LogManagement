import { z } from 'zod';
import { logFilterShape } from '../logs/logs.schema.js';

export const bucketSeconds = { minute: 60, hour: 3600, day: 86400 };
function range(schema, timeline = false) {
  return schema.transform((input, ctx) => {
    const to = input.to ?? new Date().toISOString();
    const from = input.from ?? new Date(Date.parse(to) - 86400000).toISOString();
    const duration = Date.parse(to) - Date.parse(from);
    if (duration <= 0 || duration > 90 * 86400000) {
      ctx.addIssue({ code: 'custom', message: 'Range must be positive and at most 90 days' });
      return z.NEVER;
    }
    if (timeline && Math.ceil(duration / (bucketSeconds[input.interval] * 1000)) > 1000) {
      ctx.addIssue({ code: 'custom', message: 'Timeline must contain at most 1000 buckets' });
      return z.NEVER;
    }
    return { ...input, from: new Date(from).toISOString(), to: new Date(to).toISOString() };
  });
}
export const summarySchema = range(z.object({ ...logFilterShape,
  top: z.coerce.number().int().min(1).max(20).default(10),
}).strict());
export const timelineSchema = range(z.object({ ...logFilterShape,
  interval: z.enum(['minute', 'hour', 'day']).default('hour'),
}).strict(), true);