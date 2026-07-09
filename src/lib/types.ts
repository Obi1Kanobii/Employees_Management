export type UserRole = "admin" | "employee";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  hourly_rate: number;
  created_at?: string;
}

export interface Shift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  google_event_id?: string | null;
  created_at?: string;
  users?: Pick<User, "full_name" | "hourly_rate" | "email">;
}
