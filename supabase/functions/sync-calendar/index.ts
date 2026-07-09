import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIMEZONE = "Asia/Jerusalem";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  raw_data?: string; // Captures attendees and other fields for matching
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const bin = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const normalized = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getGoogleAccessToken(
  serviceAccount: ServiceAccount
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/calendar.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );
  const jwt = `${header}.${payload}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

async function getOAuthAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google OAuth token refresh failed: ${err}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

async function resolveGoogleAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

  if (clientId && clientSecret && refreshToken) {
    return getOAuthAccessToken(clientId, clientSecret, refreshToken);
  }

  if (serviceAccountJson) {
    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);
    return getGoogleAccessToken(serviceAccount);
  }

  throw new Error(
    "Calendar API auth not configured. Set GOOGLE_CALENDAR_ICAL_URL (easiest), or OAuth / service account secrets."
  );
}

function unfoldIcs(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function icsPropertyValue(line: string): { name: string; value: string } | null {
  const sep = line.indexOf(":");
  if (sep === -1) return null;
  const name = line.slice(0, sep).split(";")[0];
  return { name, value: line.slice(sep + 1) };
}

function icsDateToIso(raw: string): string {
  if (raw.length === 8) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    return `${y}-${m}-${d}T00:00:00`;
  }

  const isUtc = raw.endsWith("Z");
  const clean = raw.replace("Z", "");
  const y = clean.slice(0, 4);
  const m = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  const h = clean.slice(9, 11) || "00";
  const min = clean.slice(11, 13) || "00";
  const s = clean.slice(13, 15) || "00";

  if (isUtc) {
    return new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString();
  }

  const local = new Date(`${y}-${m}-${d}T${h}:${min}:${s}`);
  const tzOffset = getTimezoneOffsetMinutes(local, TIMEZONE);
  return new Date(local.getTime() - tzOffset * 60_000).toISOString();
}

function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);
  const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = offset.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2]);
  const mins = Number(match[3] ?? 0);
  return sign * (hours * 60 + mins);
}

function parseIcsEvents(icsText: string): CalendarEvent[] {
  const text = unfoldIcs(icsText);
  const events: CalendarEvent[] = [];

  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const end = block.indexOf("END:VEVENT");
    if (end === -1) continue;

    const fields: Record<string, string> = {};
    for (const line of block.slice(0, end).split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const prop = icsPropertyValue(trimmed);
      if (!prop) continue;
      fields[prop.name] = prop.value;
    }

    const uid = fields.UID;
    const dtstart = fields.DTSTART;
    const dtend = fields.DTEND;
    if (!uid || !dtstart || !dtend) continue;

    // Store the entire raw block so we can inspect it and extract emails from it
    const rawBlock = block.slice(0, end);

    events.push({
      id: uid,
      summary: fields.SUMMARY,
      description: fields.DESCRIPTION,
      location: fields.LOCATION,
      start: { dateTime: icsDateToIso(dtstart) },
      end: { dateTime: icsDateToIso(dtend) },
      raw_data: rawBlock,
    });
  }

  return events;
}

async function fetchEventsFromIcal(
  icalUrl: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const res = await fetch(icalUrl);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch iCal feed: ${err}`);
  }

  const icsText = await res.text();
  const events = parseIcsEvents(icsText);

  return events.filter((event) => {
    const startIso = event.start?.dateTime ?? event.start?.date;
    if (!startIso) return false;
    const start = new Date(startIso);
    return start >= timeMin && start <= timeMax;
  });
}

async function fetchCalendarEventsFromApi(
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
  if (!calendarId) {
    throw new Error("GOOGLE_CALENDAR_ID is required for API-based sync.");
  }

  const accessToken = await resolveGoogleAccessToken();
  return fetchCalendarEvents(
    accessToken,
    calendarId,
    timeMin.toISOString(),
    timeMax.toISOString()
  );
}

async function resolveCalendarEvents(
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const icalUrl = Deno.env.get("GOOGLE_CALENDAR_ICAL_URL");
  if (icalUrl) {
    return fetchEventsFromIcal(icalUrl, timeMin, timeMax);
  }

  return fetchCalendarEventsFromApi(timeMin, timeMax);
}

function formatDateInTimezone(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function formatTimeInTimezone(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function calculateHours(
  clockIn: string,
  clockOut: string
): number {
  const [inH, inM] = clockIn.split(":").map(Number);
  const [outH, outM] = clockOut.split(":").map(Number);
  let totalMinutes = outH * 60 + outM - (inH * 60 + inM);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  return Math.max(0, Math.round((totalMinutes / 60) * 100) / 100);
}

function matchEmployee(
  event: CalendarEvent,
  employees: Employee[]
): Employee | null {
  const searchText = [
    event.raw_data ?? "",
    event.summary ?? "",
    event.description ?? "",
    event.location ?? "",
  ].join(" ").toLowerCase();

  for (const emp of employees) {
    // 1. Full email anywhere in the event (organizer, attendee, description)
    if (emp.email && searchText.includes(emp.email.toLowerCase())) {
      return emp;
    }

    // 2. Username before @ — "yuval" matches yuval@betterai360.com
    const username = emp.email.split("@")[0].toLowerCase();
    if (username && searchText.includes(username)) {
      return emp;
    }

    // 3. Employee full_name — set this in the DB to the name used in calendar titles
    //    e.g. set full_name = "אלעד" so events titled "אלעד" match Elad
    if (emp.full_name) {
      const name = emp.full_name.trim().toLowerCase();
      if (name && searchText.includes(name)) {
        return emp;
      }
    }
  }

  return null;
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Calendar API error: ${err}`);
    }

    const data = await res.json();
    events.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const icalUrl = Deno.env.get("GOOGLE_CALENDAR_ICAL_URL");
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
    const hasOAuth =
      !!Deno.env.get("GOOGLE_CLIENT_ID") &&
      !!Deno.env.get("GOOGLE_CLIENT_SECRET") &&
      !!Deno.env.get("GOOGLE_REFRESH_TOKEN");
    const hasApiAuth =
      !!calendarId &&
      (hasOAuth || !!Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON"));

    if (!icalUrl && !hasApiAuth) {
      return jsonResponse(
        {
          error:
            "Calendar sync is not configured. Set GOOGLE_CALENDAR_ICAL_URL (easiest), or API credentials in Supabase Edge Function secrets.",
        },
        503
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: userProfile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userProfile?.role !== "admin") {
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const weeksBack = Number(body.weeksBack ?? 4);
    const weeksForward = Number(body.weeksForward ?? 1);

    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - weeksBack * 7);
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + weeksForward * 7);

    const events = await resolveCalendarEvents(timeMin, timeMax);

    const { data: users } = await adminClient
      .from("users")
      .select("id, full_name, email")
      .eq("role", "employee");

    const employees: Employee[] = (users ?? []).map((u) => ({
      id: u.id,
      full_name: u.full_name || "",
      email: u.email || "",
    }));

    if (employees.length === 0) {
      return jsonResponse(
        {
          error:
            "No employees found in users table. Add yuval@betterai360.com and elad@betterai360.com to public.users first.",
        },
        400
      );
    }

    let eventsProcessed = 0;
    let entriesUpserted = 0;
    let eventsSkipped = 0;
    const errors: string[] = [];

    for (const event of events) {
      eventsProcessed++;

      const startIso = event.start?.dateTime ?? event.start?.date;
      const endIso = event.end?.dateTime ?? event.end?.date;
      if (!startIso || !endIso) {
        errors.push(`Skipped "${event.summary || 'Untitled'}" - missing start or end time.`);
        eventsSkipped++;
        continue;
      }

      const employee = matchEmployee(event, employees);
      if (!employee) {
        // Show first 300 chars of the raw iCal block to diagnose email format
        const rawSnippet = (event.raw_data || "(none)").slice(0, 300).replace(/\n/g, " | ");
        errors.push(`Skipped "${event.summary || 'Untitled'}" - raw block: ${rawSnippet}`);
        eventsSkipped++;
        continue;
      }

      const date = formatDateInTimezone(startIso);
      const start_time = formatTimeInTimezone(startIso);
      const end_time = formatTimeInTimezone(endIso);
      const duration_hours = calculateHours(start_time, end_time);

      const { error: entryError } = await adminClient.from("shifts").upsert(
        {
          user_id: employee.id,
          date,
          start_time,
          end_time,
          duration_hours,
          google_event_id: event.id,
        },
        { onConflict: "google_event_id" }
      );

      if (entryError) {
        errors.push(`Entry error for ${event.summary}: ${entryError.message}`);
        eventsSkipped++;
        continue;
      }

      entriesUpserted++;
    }

    return jsonResponse({
      ok: true,
      eventsProcessed,
      entriesUpserted,
      eventsSkipped,
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return jsonResponse({ error: message }, 500);
  }
});
