import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";
import TimesheetForm from "./TimesheetForm";
import SignOutButton from "@/components/SignOutButton";

export default async function EmployeeDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await ensureProfile(supabase, user);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") redirect("/admin/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Welcome, {profile?.full_name}
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
