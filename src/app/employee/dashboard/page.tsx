import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogOut, Calendar } from "lucide-react";
import Link from "next/link";
import { Shift } from "@/lib/types";
import { getBasePath } from "@/lib/base-path";
import SignOutButton from "@/components/SignOutButton";

export default async function EmployeeDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Double check role
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin/dashboard");
  }

  const { data: shifts } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  const totalHours = (shifts || []).reduce((acc, shift) => acc + Number(shift.duration_hours), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            <Calendar size={20} className="text-blue-600" />
            My Shifts
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">
              Welcome, {profile?.full_name || profile?.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h1 className="text-xl font-bold text-slate-900 mb-1">Your Shifts</h1>
            <p className="text-sm text-slate-500">
              These shifts are synced automatically from Google Calendar. Total logged hours: {totalHours.toFixed(2)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm">
                  <th className="p-4 font-medium text-slate-600">Date</th>
                  <th className="p-4 font-medium text-slate-600">Start Time</th>
                  <th className="p-4 font-medium text-slate-600">End Time</th>
                  <th className="p-4 font-medium text-slate-600 text-right">Duration (Hrs)</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {(shifts || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No shifts found. Shifts will appear here when they are added to Google Calendar.
                    </td>
                  </tr>
                ) : (
                  (shifts as Shift[]).map((shift) => (
                    <tr
                      key={shift.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4 text-slate-900 font-medium">{shift.date}</td>
                      <td className="p-4 text-slate-600">{shift.start_time}</td>
                      <td className="p-4 text-slate-600">{shift.end_time}</td>
                      <td className="p-4 text-slate-900 text-right font-medium">
                        {Number(shift.duration_hours).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
