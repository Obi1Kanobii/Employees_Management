"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/profile";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { profile } = await ensureProfile(supabase, user);
      router.replace(
        profile?.role === "admin" ? "/admin/dashboard" : "/employee/dashboard"
      );
    }

    redirect();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Loading...
    </div>
  );
}
