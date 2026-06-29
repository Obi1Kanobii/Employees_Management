"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { withBasePath } from "@/lib/base-path";

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get("code");
      const supabase = createClient();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          router.replace(withBasePath("/"));
          return;
        }
      }

      router.replace(withBasePath("/login?error=auth"));
    }

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Signing you in...
    </div>
  );
}
