import argon2 from 'argon2';
import { z } from 'zod';
import { loadEnv } from '../src/config/env.js';
import { createDatabase } from '../src/db/pool.js';

let database;
try {
  const config = loadEnv();
  const input = z.object({
    ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
    ADMIN_PASSWORD: z.string().min(8).max(1024),
    ADMIN_TENANT_SLUG: z.string().min(1),
  }).safeParse(process.env);
  if (!input.success) throw new Error('Provide ADMIN_EMAIL, ADMIN_PASSWORD (8+ characters), ADMIN_TENANT_SLUG');
  database = createDatabase(config);
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_TENANT_SLUG: slug } = input.data;
  const { rows: [tenant] } = await database.pool.query('SELECT id FROM tenants WHERE slug=$1 AND is_active', [slug]);
  if (!tenant) throw new Error('Active tenant not found');
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  await database.pool.query(`INSERT INTO users(tenant_id,email,password_hash,display_name,role,is_active)
    VALUES($1,$2,$3,'Administrator','admin',true)`, [tenant.id, email, hash]);
  console.log('Administrator created. Existing accounts are never overwritten.');
} catch {
  console.error('Admin creation failed. Check input, active tenant and duplicate email. No password is logged.');
  process.exitCode = 1;
} finally { await database?.close(); }