import { createClient } from "@supabase/supabase-js";
import ws from "ws";

// Server-side client with service role - never import from client components.
// `ws` transport keeps supabase-js happy on Node 20 (no native WebSocket).
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false },
    realtime: { transport: ws as never },
  });
}
