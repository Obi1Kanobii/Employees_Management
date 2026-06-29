"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/profile";
import { withBasePath } from "@/lib/base-path";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(withBasePath("/login"));
        return;
      }

      const { profile } = await ensureProfile(supabase, user);
      router.replace(
        profile?.role === "admin"
          ? withBasePath("/admin/dashboard")
          : withBasePath("/employee/dashboard")
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
