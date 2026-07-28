import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Server-side client using the SERVICE ROLE key. Never exposed to the
 * frontend. Used purely for Storage — Prisma handles all DB access directly.
 */
export const supabaseAdmin = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: { persistSession: false },
});