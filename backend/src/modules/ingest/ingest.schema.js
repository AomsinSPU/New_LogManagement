import { z } from 'zod';
import { isIP } from 'node:net';

const text = (max = 255) => z.string().trim().min(1).max(max).refine(value => !value.includes('\u0000'));
const ip = z.string().refine(value => isIP(value) !== 0);
export const ingestSchema = z.object({
  source: z.enum(['api', 'ad', 'aws', 'm365', 'crowdstrike', 'firewall', 'network']),
  '@timestamp': z.string().datetime({ offset: true }).optional(),
  event_type: text(100),
  event_subtype: text(100).optional(),
  action: text(100).optional(),
  outcome: z.enum(['success', 'failure', 'unknown']).default('unknown'),
  severity: z.number().int().min(0).max(10).optional(),
  message: text(16384).optional(),
  src_ip: ip.optional(), dst_ip: ip.optional(),
  src_port: z.number().int().min(0).max(65535).optional(),
  dst_port: z.number().int().min(0).max(65535).optional(),
  protocol: text(32).optional(),
  user: text().optional(), host: text().optional(),
  vendor: text().optional(), product: text().optional(), source_event_id: text().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}).refine(value => {
    const json = JSON.stringify(value);
    return Buffer.byteLength(json) <= 65536 && !/\\u0000/i.test(json);
  }),
  tags: z.array(text(64)).max(32).default([]),
}).strict();