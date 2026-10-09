/** Max calendar days in the past (Europe/Bratislava) for volunteer work dates. */
export const WORK_REPORT_REPORTING_WINDOW_DAYS = 30;

export const BRATISLAVA_TZ = "Europe/Bratislava";

/** YYYY-MM-DD in Europe/Bratislava for an instant. */
export function bratislavaDateKey(isoOrDate: string | Date = new Date()): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BRATISLAVA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dateKeyToUtcDayMs(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return null;
  }
  return Date.UTC(y, mo - 1, d);
}

/**
 * True when the work calendar day (Bratislava) is more than
 * `WORK_REPORT_REPORTING_WINDOW_DAYS` before today's Bratislava calendar day.
 */
export function isWorkReportDateOutsideWindow(
  dateStartedUnix: number,
  now: Date = new Date(),
): boolean {
  if (!Number.isFinite(dateStartedUnix) || dateStartedUnix < 1) return true;
  const workDay = bratislavaDateKey(new Date(dateStartedUnix * 1000));
  const today = bratislavaDateKey(now);
  if (!workDay || !today) return true;
  const workMs = dateKeyToUtcDayMs(workDay);
  const todayMs = dateKeyToUtcDayMs(today);
  if (workMs == null || todayMs == null) return true;
  const maxAgeMs = WORK_REPORT_REPORTING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return todayMs - workMs > maxAgeMs;
}
