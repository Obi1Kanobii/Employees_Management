import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Profile } from "./types";

export type EnsureProfileResult = {
  profile: Profile | null;
  error?: string;
};

export async function ensureProfile(
  supabase: SupabaseClient,
  user: User
): Promise<EnsureProfileResult> {
  const fullName =
    user.user_metadata?.full_name ??
    user.email?.split("@")[0] ??
    "Employee";

  const { data, error } = await supabase.rpc("ensure_user_profile", {
    full_name: fullName,
  });

  if (!error && data) {
    await supabase.auth.refreshSession();
    return { profile: data as Profile };
  }

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.auth.refreshSession();
    return { profile: existing as Profile };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, full_name: fullName })
    .select()
    .single();

  if (inserted) {
    await supabase.auth.refreshSession();
    return { profile: inserted as Profile };
  }

  const message =
    insertError?.message ??
    selectError?.message ??
    error?.message ??
    "Unknown error creating profile";

  console.error("Failed to create profile:", message);
  return { profile: null, error: message };
}
