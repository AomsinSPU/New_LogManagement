import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const port = z.coerce.number().int().min(1).max(65535);
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: port.default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173').refine((value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
    } catch { return false; }
  }),
  DATABASE_URL: z.preprocess((value) => value === '' ? undefined : value,
    z.string().url().refine((value) => {
      const url = new URL(value);
      return ['postgres:', 'postgresql:'].includes(url.protocol)
        && !['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl'].some((key) => url.searchParams.has(key));
    }).optional()),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: port.default(5432),
  POSTGRES_DB: z.string().min(1).optional(),
  POSTGRES_USER: z.string().min(1).optional(),
  POSTGRES_PASSWORD: z.string().min(1).optional(),
  DB_SSL: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(60000).default(5000),
  DB_QUERY_TIMEOUT_MS: z.coerce.number().int().min(100).max(60000).default(5000),
}).superRefine((value, context) => {
  if (!value.DATABASE_URL) {
    for (const key of ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']) {
      if (!value[key]) context.addIssue({ code: 'custom', path: [key], message: 'Required without DATABASE_URL' });
    }
  }
});

export function parseEnv(input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment variables: ${fields.join(', ')}`);
  }
  return Object.freeze(result.data);
}

export function loadEnv() {
  const result = dotenv.config({
    path: fileURLToPath(new URL('../../../.env', import.meta.url)),
    quiet: true,
  });
  if (result.error && result.error.code !== 'ENOENT') throw new Error('Unable to read environment file');
  return parseEnv(process.env);
}
