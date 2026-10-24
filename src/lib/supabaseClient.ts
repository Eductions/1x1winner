import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

/**
 * Singleton Supabase browser client (SSR-safe cookie storage).
 * Auth sessions are attached automatically to every RPC and Realtime call.
 */
export function getSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.local.example to .env.local and fill it in.",
    );
  }

  browserClient = createBrowserClient(url, anonKey, {
    realtime: {
      params: {
        // Lower reconnect delay keeps both browsers in sync after a blip.
        eventsPerSecond: 20,
      },
    },
  });

  return browserClient;
}
