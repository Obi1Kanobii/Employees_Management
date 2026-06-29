"use client";

import { useEffect, useState } from "react";
import { Clock, Save } from "lucide-react";
import { format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/profile";
import {
  calculateHours,
  DAYS,
  formatWeekRange,
  getWeekDates,
  getWeekStart,
} from "@/lib/time";
import type { DayEntry } from "@/lib/types";

function buildEmptyEntries(weekStart: Date): DayEntry[] {
  const dates = getWeekDates(weekStart);
  return DAYS.map((day, i) => ({
    day,
    workDate: dates[i],
    clockIn: "",
    clockOut: "",
    breakMins: 0,
    notes: "",
  }));
}

export default function TimesheetForm() {
  const weekStart = getWeekStart();
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const [entries, setEntries] = useState<DayEntry[]>(() =>
    buildEmptyEntries(weekStart)
  );
  const [timesheetId, setTimesheetId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  useEffect(() => {
    const weekStartDate = parseISO(weekStartStr);

    async function loadTimesheet() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: timesheet } = await supabase
        .from("timesheets")
        .select("id, status, time_entries(*)")
        .eq("employee_id", user.id)
        .eq("week_start_date", weekStartStr)
        .maybeSingle();

      if (timesheet) {
        setTimesheetId(timesheet.id);
        setStatus(timesheet.status);

        const loaded = buildEmptyEntries(weekStartDate).map((entry) => {
          const existing = timesheet.time_entries?.find(
            (te: { work_date: string }) => te.work_date === entry.workDate
          );
          if (!existing) return entry;
          return {
            ...entry,
            clockIn: existing.clock_in?.slice(0, 5) ?? "",
            clockOut: existing.clock_out?.slice(0, 5) ?? "",
            breakMins: existing.break_minutes ?? 0,
            notes: existing.notes ?? "",
          };
        });
        setEntries(loaded);
      }

      setLoading(false);
    }

    loadTimesheet();
  }, [weekStartStr]);

  const isReadOnly = status === "approved";

  const handleUpdate = (
    index: number,
    field: keyof Omit<DayEntry, "day" | "workDate">,
    value: string | number
  ) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const totalWeekHours = entries.reduce(
    (acc, curr) =>
      acc + calculateHours(curr.clockIn, curr.clockOut, curr.breakMins),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setSubmitting(true);
    setMessage("");
    setMessageIsError(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMessage("You must be signed in to submit a timesheet.");
      setMessageIsError(true);
      setSubmitting(false);
      return;
    }

    const { profile, error: profileError } = await ensureProfile(supabase, user);
    if (!profile) {
      setMessage(profileError ?? "Your profile is missing. Contact an admin.");
      setMessageIsError(true);
      setSubmitting(false);
      return;
    }

    let currentTimesheetId = timesheetId;

    if (!currentTimesheetId) {
      const { data: newTimesheet, error: tsError } = await supabase
        .from("timesheets")
        .insert({
          employee_id: user.id,
          week_start_date: weekStartStr,
          total_week_hours: totalWeekHours,
          status: "pending",
        })
        .select("id")
        .single();

      if (tsError) {
        setMessage(tsError.message);
        setMessageIsError(true);
        setSubmitting(false);
        return;
      }
      currentTimesheetId = newTimesheet.id;
      setTimesheetId(currentTimesheetId);
    } else {
      const { error: updateError } = await supabase
        .from("timesheets")
        .update({ total_week_hours: totalWeekHours, status: "pending" })
        .eq("id", currentTimesheetId);

      if (updateError) {
        setMessage(updateError.message);
        setMessageIsError(true);
        setSubmitting(false);
        return;
      }
    }

    const entryRows = entries
      .filter((e) => e.clockIn && e.clockOut)
      .map((entry) => ({
        timesheet_id: currentTimesheetId,
        work_date: entry.workDate,
        clock_in: entry.clockIn,
        clock_out: entry.clockOut,
        break_minutes: entry.breakMins,
        total_day_hours: calculateHours(
          entry.clockIn,
          entry.clockOut,
          entry.breakMins
        ),
        notes: entry.notes || null,
      }));

    if (entryRows.length > 0) {
      const { error: entryError } = await supabase
        .from("time_entries")
        .upsert(entryRows, { onConflict: "timesheet_id,work_date" });

      if (entryError) {
        setMessage(entryError.message);
        setMessageIsError(true);
        setSubmitting(false);
        return;
      }
    }

    setStatus("pending");
    setMessage("Timesheet submitted for approval!");
    setMessageIsError(false);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center text-slate-500">
        Loading timesheet...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Clock className="text-blue-600" /> Weekly Timesheet
        </h2>
        <span className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full font-semibold">
          Total: {totalWeekHours.toFixed(2)} hrs
        </span>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        Week of {formatWeekRange(weekStart)}
        {status !== "pending" && (
          <span
            className={`ml-3 px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
              status === "approved"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {status}
          </span>
        )}
      </p>

      {message && (
        <p
          className={`mb-4 text-sm p-3 rounded-lg ${
            messageIsError
              ? "text-red-700 bg-red-50"
              : "text-emerald-700 bg-emerald-50"
          }`}
        >
          {message}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {entries.map((entry, i) => (
          <div
            key={entry.day}
            className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100 items-center"
          >
            <div className="font-medium text-slate-700">{entry.day}</div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Clock In</label>
              <input
                type="time"
                disabled={isReadOnly}
                className="p-2 border rounded-md disabled:bg-slate-100"
                value={entry.clockIn}
                onChange={(e) => handleUpdate(i, "clockIn", e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Clock Out</label>
              <input
                type="time"
                disabled={isReadOnly}
                className="p-2 border rounded-md disabled:bg-slate-100"
                value={entry.clockOut}
                onChange={(e) => handleUpdate(i, "clockOut", e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Break (mins)</label>
              <input
                type="number"
                min="0"
                disabled={isReadOnly}
                className="p-2 border rounded-md disabled:bg-slate-100"
                value={entry.breakMins}
                onChange={(e) =>
                  handleUpdate(i, "breakMins", Number(e.target.value))
                }
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Hours</label>
              <div className="p-2 bg-slate-200 rounded-md text-center font-mono text-slate-700">
                {calculateHours(
                  entry.clockIn,
                  entry.clockOut,
                  entry.breakMins
                ).toFixed(2)}
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Notes</label>
              <input
                type="text"
                disabled={isReadOnly}
                placeholder="Optional notes"
                className="p-2 border rounded-md disabled:bg-slate-100"
                value={entry.notes}
                onChange={(e) => handleUpdate(i, "notes", e.target.value)}
              />
            </div>
          </div>
        ))}

        {!isReadOnly && (
          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-6 bg-slate-900 text-white p-4 rounded-lg font-medium hover:bg-slate-800 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={20} />
            {submitting ? "Submitting..." : "Submit for the Week"}
          </button>
        )}
      </form>
    </div>
  );
}
