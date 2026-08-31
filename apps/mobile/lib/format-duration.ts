import { t } from "@/lib/i18n";

/** Decimal hours (e.g. 20.167) → "20 hod. 10 min." */
export function formatDurationHoursMinutes(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return "—";
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours} ${t("duration.hours_abbr")} ${minutes} ${t("duration.minutes_abbr")}`;
}
