"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/profile";
import TimesheetForm from "./TimesheetForm";
import SignOutButton from "@/components/SignOutButton";

export default function EmployeeDashboard() {
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

      if (profile.role === "admin") {
        router.replace("/admin/dashboard");
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Welcome, {fullName}
            </h1>
            <p className="text-sm text-slate-500">Employee Dashboard</p>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="py-8 px-4">
        <TimesheetForm />
      </main>
    </div>
  );
}
