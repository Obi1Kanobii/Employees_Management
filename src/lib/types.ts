export type UserRole = "admin" | "employee";
export type TimesheetStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  hourly_rate: number;
  created_at?: string;
}

export interface Client {
  id: string;
  name: string;
  created_at?: string;
}

export interface Timesheet {
  id: string;
  employee_id: string;
  week_start_date: string;
  status: TimesheetStatus;
  total_week_hours: number;
  created_at: string;
  profiles?: Pick<Profile, "full_name" | "hourly_rate">;
}

export interface TimeEntry {
  id: string;
  timesheet_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  total_day_hours: number;
  client_id: string | null;
  notes: string | null;
  clients?: Pick<Client, "name">;
}

export interface DayEntry {
  day: string;
  workDate: string;
  clockIn: string;
  clockOut: string;
  breakMins: number;
  clientId: string;
  notes: string;
}
