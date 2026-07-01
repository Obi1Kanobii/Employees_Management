"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Users, Banknote, Clock, Building2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { formatShekels } from "@/lib/currency";
import { formatWeekRange } from "@/lib/time";
import type { Client, Timesheet, TimesheetStatus } from "@/lib/types";

interface TimesheetRow extends Timesheet {
  profiles: { full_name: string; hourly_rate: number };
}

interface ClientEntryRow {
  work_date: string;
  total_day_hours: number;
  client_id: string | null;
  clients: { name: string } | null;
  timesheets: {
    status: TimesheetStatus;
    profiles: { hourly_rate: number };
  };
}

interface ClientMonthSummary {
  clientId: string;
  clientName: string;
  monthKey: string;
  monthLabel: string;
  totalHours: number;
  totalAmount: number;
}

export default function AdminDashboard() {
  const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
  const [clientEntries, setClientEntries] = useState<ClientEntryRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [newClientName, setNewClientName] = useState("");
  const [filter, setFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [clientError, setClientError] = useState("");

  useEffect(() => {
    let active = true;

    void (async () => {
      const supabase = createClient();
      const [timesheetRes, entriesRes, clientsRes] = await Promise.all([
        supabase
          .from("timesheets")
          .select("*, profiles(full_name, hourly_rate)")
          .order("created_at", { ascending: false }),
        supabase
          .from("time_entries")
          .select(
            "work_date, total_day_hours, client_id, clients(name), timesheets!inner(status, profiles(hourly_rate))"
          ),
        supabase.from("clients").select("*").order("name"),
      ]);

      if (!active) return;
      if (!timesheetRes.error && timesheetRes.data) {
        setTimesheets(timesheetRes.data as TimesheetRow[]);
      }
      if (!entriesRes.error && entriesRes.data) {
        setClientEntries(
          entriesRes.data.map((row) => ({
            work_date: row.work_date,
            total_day_hours: row.total_day_hours,
            client_id: row.client_id,
            clients: Array.isArray(row.clients) ? row.clients[0] : row.clients,
            timesheets: {
              status: (Array.isArray(row.timesheets)
                ? row.timesheets[0]
                : row.timesheets
              ).status,
              profiles: Array.isArray(
                (Array.isArray(row.timesheets)
                  ? row.timesheets[0]
                  : row.timesheets
                ).profiles
              )
                ? (Array.isArray(row.timesheets)
                    ? row.timesheets[0]
                    : row.timesheets
                  ).profiles[0]
                : (Array.isArray(row.timesheets)
                    ? row.timesheets[0]
                    : row.timesheets
                  ).profiles,
            },
          })) as ClientEntryRow[]
        );
      }
      if (!clientsRes.error && clientsRes.data) {
        setClients(clientsRes.data);
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
      acc +
      Number(curr.total_week_hours) * Number(curr.profiles?.hourly_rate ?? 0),
    0
  );

  const clientMonthSummaries = useMemo(() => {
    const map = new Map<string, ClientMonthSummary>();

    for (const entry of clientEntries) {
      if (entry.timesheets.status !== "approved" || !entry.client_id) continue;

      const monthKey = format(parseISO(entry.work_date), "yyyy-MM");
      const key = `${entry.client_id}:${monthKey}`;
      const hours = Number(entry.total_day_hours);
      const rate = Number(entry.timesheets.profiles?.hourly_rate ?? 0);
      const existing = map.get(key);

      if (existing) {
        existing.totalHours += hours;
        existing.totalAmount += hours * rate;
      } else {
        map.set(key, {
          clientId: entry.client_id,
          clientName: entry.clients?.name ?? "Unknown",
          monthKey,
          monthLabel: format(parseISO(entry.work_date), "MMMM yyyy"),
          totalHours: hours,
          totalAmount: hours * rate,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.monthKey !== b.monthKey) return b.monthKey.localeCompare(a.monthKey);
      return a.clientName.localeCompare(b.clientName);
    });
  }, [clientEntries]);

  const availableMonths = useMemo(() => {
    const months = new Set(clientMonthSummaries.map((s) => s.monthKey));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [clientMonthSummaries]);

  const filteredClientSummaries =
    monthFilter === "all"
      ? clientMonthSummaries
      : clientMonthSummaries.filter((s) => s.monthKey === monthFilter);

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
      setClientEntries((prev) =>
        prev.map((e) =>
          e.timesheets ? { ...e, timesheets: { ...e.timesheets, status } } : e
        )
      );
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newClientName.trim();
    if (!name) return;

    setClientError("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clients")
      .insert({ name })
      .select()
      .single();

    if (error) {
      setClientError(error.message);
      return;
    }

    setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewClientName("");
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

  const handleExportClientCSV = () => {
    const headers = "Client,Month,Hours,Amount (ILS)\n";
    const rows = filteredClientSummaries
      .map(
        (s) =>
          `${s.clientName},${s.monthLabel},${s.totalHours.toFixed(2)},${s.totalAmount.toFixed(2)}`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "client_monthly_summary.csv";
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
          <Download size={18} /> Export Payroll CSV
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
            <Banknote size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">
              Estimated Payroll
            </p>
            <p className="text-2xl font-bold text-slate-900">
              {formatShekels(estPayroll)}
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
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={20} className="text-slate-600" />
            <h3 className="font-bold text-slate-800">Clients</h3>
          </div>
          <form onSubmit={handleAddClient} className="flex gap-2 max-w-md">
            <input
              type="text"
              placeholder="New client name"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="flex-1 p-2 border border-slate-300 rounded-md text-sm"
            />
            <button
              type="submit"
              className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800 transition"
            >
              Add
            </button>
          </form>
          {clientError && (
            <p className="text-sm text-red-600 mt-2">{clientError}</p>
          )}
          {clients.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {clients.map((client) => (
                <span
                  key={client.id}
                  className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                >
                  {client.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">
            Hours &amp; Cost per Client (Monthly)
          </h3>
          <div className="flex items-center gap-2">
            <select
              className="p-2 border border-slate-300 rounded-md text-sm"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            >
              <option value="all">All Months</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {format(parseISO(`${month}-01`), "MMMM yyyy")}
                </option>
              ))}
            </select>
            <button
              onClick={handleExportClientCSV}
              className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-md font-medium flex items-center gap-1"
            >
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        {filteredClientSummaries.length === 0 ? (
          <p className="p-8 text-center text-slate-500">
            No approved hours with a client assigned yet.
          </p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Month</th>
                <th className="p-4 font-medium">Total Hours</th>
                <th className="p-4 font-medium">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {filteredClientSummaries.map((row) => (
                <tr
                  key={`${row.clientId}-${row.monthKey}`}
                  className="border-b border-slate-100 hover:bg-slate-50 transition"
                >
                  <td className="p-4 font-medium text-slate-800">
                    {row.clientName}
                  </td>
                  <td className="p-4 text-slate-600">{row.monthLabel}</td>
                  <td className="p-4 font-mono text-slate-700">
                    {row.totalHours.toFixed(1)}h
                  </td>
                  <td className="p-4 font-mono text-slate-700">
                    {formatShekels(row.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold text-slate-800">
                <td className="p-4" colSpan={2}>
                  Total
                </td>
                <td className="p-4 font-mono">
                  {filteredClientSummaries
                    .reduce((acc, r) => acc + r.totalHours, 0)
                    .toFixed(1)}
                  h
                </td>
                <td className="p-4 font-mono">
                  {formatShekels(
                    filteredClientSummaries.reduce(
                      (acc, r) => acc + r.totalAmount,
                      0
                    )
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
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
                      {formatShekels(pay)}
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
