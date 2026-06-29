"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { withBasePath } from "@/lib/base-path";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(withBasePath("/login"));
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
    >
      <LogOut size={16} />
      Sign Out
    </button>
  );
}
