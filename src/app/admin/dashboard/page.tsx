"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/profile";
import AdminDashboard from "./AdminDashboard";
import SignOutButton from "@/components/SignOutButton";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { profile } = await ensureProfile(supabase, user);
      if (!profile) return;

      if (profile.role !== "admin") {
        router.replace("/employee/dashboard");
        return;
      }

      setFullName(profile.full_name);
    }

    load();
  }, [router]);

  if (!fullName) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {fullName}
            </h1>
            <p className="text-sm text-slate-500">Admin Dashboard</p>
          </div>
          <SignOutButton />
        </div>
      </header>
      <AdminDashboard />
    </div>
  );
}
