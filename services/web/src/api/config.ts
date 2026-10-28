export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5080";

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
};

export function isSupabasePublicConfigComplete(url?: string, anonKey?: string): boolean {
  return Boolean(url?.trim() && anonKey?.trim());
}

export const hasSupabasePublicConfig = isSupabasePublicConfigComplete(
  supabaseConfig.url,
  supabaseConfig.anonKey,
);
