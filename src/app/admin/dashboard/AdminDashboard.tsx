"use client";

import { useEffect, useState } from "react";
import { Download, Users, DollarSign, Clock } from "lucide-react";
import { parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { formatWeekRange } from "@/lib/time";
import type { Timesheet, TimesheetStatus } from "@/lib/types";

interface TimesheetRow extends Timesheet {
  profiles: { full_name: string; hourly_rate: number };
}

export default function AdminDashboard() {
  const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("timesheets")
        .select("*, profiles(full_name, hourly_rate)")
        .order("created_at", { ascending: false });

      if (!active) return;
      if (!error && data) {
        setTimesheets(data as TimesheetRow[]);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const filteredData =
    filter === "all"
      ? timesheets
      : timesheets.filter((t) => t.status === filter);

  const totalHours = timesheets.reduce(
    (acc, curr) => acc + Number(curr.total_week_hours),
    0
  );
  const estPayroll = timesheets.reduce(
    (acc, curr) =>
      acc + Number(curr.total_week_hours) * Number(curr.profiles?.hourly_rate ?? 0),
    0
  );

  const handleStatusChange = async (id: string, status: TimesheetStatus) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("timesheets")
      .update({ status })
      .eq("id", id);

    if (!error) {
      setTimesheets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status } : t))
      );
    }
  };

  const handleExportCSV = () => {
    const headers = "Name,Week,Hours,Rate,Status,Pay\n";
    const rows = filteredData
      .map((t) => {
        const weekStart = parseISO(t.week_start_date);
        const pay =
          Number(t.total_week_hours) * Number(t.profiles?.hourly_rate ?? 0);
        return `${t.profiles?.full_name},${formatWeekRange(weekStart)},${t.total_week_hours},${t.profiles?.hourly_rate},${t.status},${pay.toFixed(2)}`;
      })
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payroll_export.csv";
    a.click();
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">Loading dashboard...</div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">Admin Overview</h1>
        <button
          onClick={handleExportCSV}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Download size={18} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">
              Total Hours (All Submissions)
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {totalHours.toFixed(1)}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">
              Estimated Payroll
            </p>
            <p className="text-2xl font-bold text-slate-900">
              ${estPayroll.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-purple-100 text-purple-600 rounded-full">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">
              Pending Approvals
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {timesheets.filter((t) => t.status === "pending").length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Timesheet Submissions</h3>
          <select
            className="p-2 border border-slate-300 rounded-md text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {filteredData.length === 0 ? (
          <p className="p-8 text-center text-slate-500">
            No timesheet submissions yet.
          </p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="p-4 font-medium">Employee</th>
                <th className="p-4 font-medium">Week</th>
                <th className="p-4 font-medium">Total Hours</th>
                <th className="p-4 font-medium">Est. Pay</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row) => {
                const pay =
                  Number(row.total_week_hours) *
                  Number(row.profiles?.hourly_rate ?? 0);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition"
                  >
                    <td className="p-4 font-medium text-slate-800">
                      {row.profiles?.full_name}
                    </td>
                    <td className="p-4 text-slate-600">
                      {formatWeekRange(parseISO(row.week_start_date))}
                    </td>
                    <td className="p-4 font-mono text-slate-700">
                      {Number(row.total_week_hours).toFixed(1)}h
                    </td>
                    <td className="p-4 font-mono text-slate-700">
                      ${pay.toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${row.status === "approved" ? "bg-emerald-100 text-emerald-700" : ""}
                        ${row.status === "pending" ? "bg-amber-100 text-amber-700" : ""}
                        ${row.status === "rejected" ? "bg-red-100 text-red-700" : ""}
                      `}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {row.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              handleStatusChange(row.id, "approved")
                            }
                            className="text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded text-sm font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              handleStatusChange(row.id, "rejected")
                            }
                            className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-sm font-medium"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
