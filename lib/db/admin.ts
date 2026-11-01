import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The service-role client. It bypasses RLS, so it lives in server-only code and
// is only used after the caller's role and scope were checked.
let client: SupabaseClient | undefined;

export function adminClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("The Supabase environment variables are not set.");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
