import { createClient } from "@supabase/supabase-js";
import { hasSupabasePublicConfig, supabaseConfig } from "./config";

// Only the public anon key belongs in a browser. RLS must protect all user data.
export const supabase = hasSupabasePublicConfig
  ? createClient(supabaseConfig.url!, supabaseConfig.anonKey!)
  : null;
