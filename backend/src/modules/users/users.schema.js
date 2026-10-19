import { z } from 'zod';
const name = z.string().trim().min(1).max(255).refine(v => !v.includes('\u0000'));
export const passwordSchema = z.string().min(12).max(128).refine(v => !v.includes('\u0000'));
export const createUserSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254),
  display_name: name, password: passwordSchema, role: z.enum(['admin','viewer']).default('viewer') }).strict();
export const patchUserSchema = z.object({ display_name: name.optional(), role: z.enum(['admin','viewer']).optional(),
  is_active: z.boolean().optional() }).strict().refine(v => Object.keys(v).length > 0);
export const changePasswordSchema = z.object({ current_password: z.string().min(1).max(1024), new_password: passwordSchema })
  .strict().refine(v => v.current_password !== v.new_password);