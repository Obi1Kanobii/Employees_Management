import { addDays, format, startOfWeek } from "date-fns";

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function getWeekStart(date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function getWeekDates(weekStart: Date): string[] {
  return DAYS.map((_, i) => format(addDays(weekStart, i), "yyyy-MM-dd"));
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
}

export function calculateHours(
  inTime: string,
  outTime: string,
  breakMins: number
): number {
  if (!inTime || !outTime) return 0;

  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);

  let totalMinutes = outH * 60 + outM - (inH * 60 + inM);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  totalMinutes -= breakMins || 0;

  return Math.max(0, Math.round((totalMinutes / 60) * 100) / 100);
}
