declare global {
  interface Window {
    __SUPABASE_CONFIG__?: {
      url: string;
      anonKey: string;
    };
  }
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    (typeof window !== "undefined" ? window.__SUPABASE_CONFIG__?.url : "") ||
    "";

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    (typeof window !== "undefined" ? window.__SUPABASE_CONFIG__?.anonKey : "") ||
    "";

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY as GitHub Actions secrets, then redeploy."
    );
  }

  return { url, anonKey };
}
