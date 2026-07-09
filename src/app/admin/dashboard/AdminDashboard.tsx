"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  RefreshCw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { formatShekels } from "@/lib/currency";
import { syncCalendarFromGoogle } from "@/lib/calendar-sync";
import type { Shift } from "@/lib/types";

interface ShiftRow extends Shift {
  users?: { full_name: string; email: string; hourly_rate: number };
}

interface MonthlySummary {
  userId: string;
  userName: string;
  userEmail: string;
  monthKey: string;
  monthLabel: string;
  totalHours: number;
  totalAmount: number;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"shifts" | "payroll">("shifts");
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [monthFilter, setMonthFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncIsError, setSyncIsError] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      const supabase = createClient();
      const shiftsRes = await supabase
        .from("shifts")
        .select("*, users(full_name, email, hourly_rate)")
        .order("date", { ascending: false })
        .order("start_time", { ascending: false });

      if (!active) return;
      if (!shiftsRes.error && shiftsRes.data) {
        setShifts(shiftsRes.data as ShiftRow[]);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const monthlySummaries = useMemo(() => {
    const map = new Map<string, MonthlySummary>();
    for (const shift of shifts) {
      if (!shift.user_id) continue;

      const monthKey = format(parseISO(shift.date), "yyyy-MM");
      const key = `${shift.user_id}:${monthKey}`;
      const hours = Number(shift.duration_hours);
      const rate = Number(shift.users?.hourly_rate ?? 0);
      const existing = map.get(key);

      if (existing) {
        existing.totalHours += hours;
        existing.totalAmount += hours * rate;
      } else {
        map.set(key, {
          userId: shift.user_id,
          userName: shift.users?.full_name || "Unknown",
          userEmail: shift.users?.email || "",
          monthKey,
          monthLabel: format(parseISO(shift.date), "MMMM yyyy"),
          totalHours: hours,
          totalAmount: hours * rate,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.monthKey !== b.monthKey) return b.monthKey.localeCompare(a.monthKey);
      return a.userName.localeCompare(b.userName);
    });
  }, [shifts]);

  const availableMonths = useMemo(() => {
    return Array.from(new Set(monthlySummaries.map((s) => s.monthKey))).sort((a, b) => b.localeCompare(a));
  }, [monthlySummaries]);

  const handleCalendarSync = async () => {
    setSyncing(true);
    setSyncMessage("");
    setSyncIsError(false);
    const result = await syncCalendarFromGoogle();
    if (!result.ok) {
      setSyncMessage(result.error ?? "Calendar sync failed.");
      setSyncIsError(true);
      setSyncing(false);
      return;
    }
    setSyncMessage(
      `Synced ${result.entriesUpserted ?? 0} shift(s) from ${result.eventsProcessed ?? 0} calendar events.` +
        (result.eventsSkipped ? ` Skipped ${result.eventsSkipped}.` : "") +
        (result.errors?.length ? ` ${result.errors[0]}` : "")
    );
    
    // Refresh shifts
    const supabase = createClient();
    const { data } = await supabase
      .from("shifts")
      .select("*, users(full_name, email, hourly_rate)")
      .order("date", { ascending: false })
      .order("start_time", { ascending: false });
    
    if (data) {
      setShifts(data as ShiftRow[]);
    }
    
    setSyncing(false);
  };

  const downloadCsv = (monthKey: string) => {
    const dataToExport = monthKey === "all" ? monthlySummaries : monthlySummaries.filter(s => s.monthKey === monthKey);
    if (dataToExport.length === 0) return;

    const headers = ["Month", "Employee Name", "Email", "Total Hours", "Total Pay (ILS)"];
    const rows = dataToExport.map(s => [
      s.monthLabel,
      s.userName,
      s.userEmail,
      s.totalHours.toFixed(2),
      s.totalAmount.toFixed(2)
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payroll_summary_${monthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading dashboard...</div>;
  }

  const filteredSummaries = monthFilter === "all" ? monthlySummaries : monthlySummaries.filter(s => s.monthKey === monthFilter);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage employee shifts and payroll</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        {(["shifts", "payroll"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "shifts" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-lg">All Logged Shifts</h3>
              <button
                onClick={() => void handleCalendarSync()}
                disabled={syncing}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70"
              >
                <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Syncing..." : "Sync from Google Calendar"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Employee</th>
                  <th className="p-4 font-semibold">Start</th>
                  <th className="p-4 font-semibold">End</th>
                  <th className="p-4 font-semibold text-right">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-500">No shifts found. Sync calendar to fetch data.</td></tr>
                ) : (
                  shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-slate-50/80 transition group">
                      <td className="p-4 font-medium text-slate-900">{shift.date}</td>
                      <td className="p-4 text-slate-900">
                        {shift.users?.full_name}
                        <div className="text-xs text-slate-500">{shift.users?.email}</div>
                      </td>
                      <td className="p-4 text-slate-600">{shift.start_time}</td>
                      <td className="p-4 text-slate-600">{shift.end_time}</td>
                      <td className="p-4 font-mono text-slate-900 text-right font-medium">{Number(shift.duration_hours).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          </div>

          {syncMessage && (
            <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${syncIsError ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${syncIsError ? "bg-red-500" : "bg-emerald-500"}`} />
              {syncMessage}
            </div>
          )}
        </div>
      )}

      {activeTab === "payroll" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-lg">Monthly Payroll Summary</h3>
            <div className="flex gap-3">
              <select
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                <option value="all">All Months</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>{format(parseISO(`${month}-01`), "MMMM yyyy")}</option>
                ))}
              </select>
              <button
                onClick={() => downloadCsv(monthFilter)}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition flex items-center gap-2"
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>
          
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Month</th>
                <th className="p-4 font-semibold">Employee</th>
                <th className="p-4 font-semibold text-right">Total Hours</th>
                <th className="p-4 font-semibold text-right">Est. Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSummaries.length === 0 ? (
                <tr><td colSpan={4} className="p-12 text-center text-slate-500">No payroll data found for this period.</td></tr>
              ) : (
                filteredSummaries.map((row) => (
                  <tr key={`${row.userId}-${row.monthKey}`} className="hover:bg-slate-50 transition">
                    <td className="p-4 text-slate-600 font-medium">{row.monthLabel}</td>
                    <td className="p-4 font-medium text-slate-900">
                      {row.userName}
                      <div className="text-xs text-slate-500">{row.userEmail}</div>
                    </td>
                    <td className="p-4 font-mono text-slate-700 text-right">{row.totalHours.toFixed(2)}h</td>
                    <td className="p-4 font-mono text-slate-900 font-medium text-right">{formatShekels(row.totalAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
