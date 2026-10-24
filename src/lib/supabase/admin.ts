import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase Admin client.
 *
 * The service-role key bypasses RLS, so this module must only ever be
 * imported by Route Handlers / server code after the caller has been
 * authorized. Never expose this key with a NEXT_PUBLIC_ prefix.
 */
export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("ADMIN_NOT_CONFIGURED");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
