export const TIMEZONE = "Indian/Mauritius";

export function mauritiusDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function mauritiusEvening(day: string): Date {
  return new Date(`${day}T19:00:00+04:00`);
}

export function endOfMauritiusDay(day: string): Date {
  return new Date(`${day}T23:59:59.999+04:00`);
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00+04:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return mauritiusDate(date);
}

export function formatLongDate(day: string): string {
  const date = new Date(`${day}T12:00:00+04:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDuration(range: { min: number; max: number }): string {
  if (range.min === range.max) return `${range.min} min`;
  return `${range.min} à ${range.max} min`;
}

export function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: TIMEZONE,
  }).format(new Date(iso));
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h} h ${mm} min`;
  if (m > 0) return `${m} min ${ss} s`;
  return `${s} s`;
}

export function relativeInterval(from: Date, due: Date): string {
  const minutes = Math.round((due.getTime() - from.getTime()) / 60000);
  if (minutes < 1) return "tout de suite";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 20) return hours === 1 ? "1 heure" : `${hours} heures`;
  const days = Math.max(1, Math.round(minutes / 1440));
  return days === 1 ? "1 jour" : `${days} jours`;
}
