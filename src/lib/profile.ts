import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import type { User } from "./types";

export type EnsureProfileResult = {
  profile: User | null;
  error?: string;
};

export async function ensureProfile(
  supabase: SupabaseClient,
  auth_user: SupabaseUser
): Promise<EnsureProfileResult> {
  const fullName =
    auth_user.user_metadata?.full_name ??
    auth_user.email?.split("@")[0] ??
    "Employee";
  const email = auth_user.email ?? "";

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "ensure_user_record",
    {
      full_name: fullName,
      email,
    }
  );

  if (!rpcError && rpcData) {
    await supabase.auth.refreshSession();
    return { profile: rpcData as User };
  }

  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("*")
    .eq("id", auth_user.id)
    .maybeSingle();

  if (existing) {
    await supabase.auth.refreshSession();
    return { profile: existing as User };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({ id: auth_user.id, email, full_name: fullName })
    .select()
    .single();

  if (inserted) {
    await supabase.auth.refreshSession();
    return { profile: inserted as User };
  }

  const message =
    rpcError?.message ??
    insertError?.message ??
    selectError?.message ??
    "Unknown error creating user record";

  console.error("Failed to create user record:", message);
  return { profile: null, error: message };
}
