import { progression } from "../content";
import { addDays, TIMEZONE } from "./dates";

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function weekdayIndex(day: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short" }).format(new Date(`${day}T12:00:00+04:00`));
  return WEEKDAY_INDEX[name] ?? 0;
}

export function isWeekend(day: string): boolean {
  const index = weekdayIndex(day);
  return index === 0 || index === 6;
}

export function mondayOf(day: string): string {
  const index = weekdayIndex(day);
  const delta = index === 0 ? -6 : 1 - index;
  return addDays(day, delta);
}

export function fridaySubject(friday: string): "Mathématiques" | "Économie" {
  const origin = Date.parse("2026-11-13T12:00:00+04:00");
  const current = Date.parse(`${friday}T12:00:00+04:00`);
  const weeks = Math.round((current - origin) / (7 * 86400000));
  return weeks % 2 === 0 ? "Mathématiques" : "Économie";
}

export interface WeekDay {
  date: string;
  label: string;
  subject: string;
}

export function schoolWeek(today: string): WeekDay[] {
  const monday = mondayOf(today);
  const friday = addDays(monday, 4);
  return [
    { date: monday, label: "Lundi", subject: "Latin" },
    { date: addDays(monday, 1), label: "Mardi", subject: "Classiques" },
    { date: addDays(monday, 2), label: "Mercredi", subject: "Latin, puis grec" },
    { date: addDays(monday, 3), label: "Jeudi", subject: "Philosophie" },
    { date: friday, label: "Vendredi", subject: fridaySubject(friday) },
  ];
}

export function studyStreak(today: string, studied: ReadonlySet<string>): number {
  let cursor = today;
  if (!isWeekend(cursor) && !studied.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    if (isWeekend(cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!studied.has(cursor)) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function studiedDates(extra: readonly string[] = []): Set<string> {
  const dates = new Set<string>(progression.activities.map((activity) => activity.date));
  for (const date of extra) dates.add(date);
  return dates;
}
