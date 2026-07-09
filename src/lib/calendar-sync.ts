import { createClient } from "@/lib/supabase/client";

export interface CalendarSyncResult {
  ok: boolean;
  eventsProcessed?: number;
  entriesUpserted?: number;
  eventsSkipped?: number;
  errors?: string[];
  error?: string;
}

async function readFunctionError(
  error: unknown,
  data: unknown
): Promise<string | undefined> {
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error?: string }).error);
  }

  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = (await context.json()) as { error?: string };
        if (body?.error) return body.error;
      } catch {
        // ignore parse errors
      }
    }
  }

  return undefined;
}

export async function syncCalendarFromGoogle(): Promise<CalendarSyncResult> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("sync-calendar", {
    body: { weeksBack: 4, weeksForward: 1 },
  });

  const responseError = await readFunctionError(error, data);

  if (error) {
    return {
      ok: false,
      error: responseError ?? error.message,
    };
  }

  if (responseError) {
    return { ok: false, error: responseError };
  }

  const result = data as CalendarSyncResult;

  if (result?.ok === false) {
    return { ok: false, error: result.error ?? "Calendar sync failed." };
  }

  return {
    ok: true,
    eventsProcessed: result.eventsProcessed,
    entriesUpserted: result.entriesUpserted,
    eventsSkipped: result.eventsSkipped,
    errors: result.errors,
  };
}
