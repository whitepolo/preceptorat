import type { DraftAnswer, GradeName, ReviewStateFile } from "./types";
import type { GradeEvent } from "./issueLink";

const PENDING_KEY = "preceptorat.pending";
const HISTORY_KEY = "preceptorat.history";
const SENT_KEY = "preceptorat.sent";
const REVIEWS_KEY = "preceptorat.revisions";

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readPending(): GradeEvent[] {
  return readJson<GradeEvent[]>(PENDING_KEY, []);
}

export function readHistory(): GradeEvent[] {
  return readJson<GradeEvent[]>(HISTORY_KEY, []);
}

export function recordGrade(cardId: string, grade: GradeName, reviewedAt: string): GradeEvent[] {
  const event: GradeEvent = { card_id: cardId, grade, reviewed_at: reviewedAt };
  const pending = [...readPending().filter((item) => item.card_id !== cardId), event];
  const history = [...readHistory(), event];
  writeJson(PENDING_KEY, pending);
  writeJson(HISTORY_KEY, history);
  return pending;
}

export function clearPending(): void {
  writeJson(PENDING_KEY, []);
}

export function readSentMap(): Record<string, string> {
  return readJson<Record<string, string>>(SENT_KEY, {});
}

export function markSent(key: string, when: string): void {
  const sent = readSentMap();
  sent[key] = when;
  writeJson(SENT_KEY, sent);
}

export interface ProgressFile {
  schema_version: "1.0";
  exported_at: string;
  reviews: ReviewStateFile;
  pending: GradeEvent[];
  history: GradeEvent[];
  drafts: Record<string, Record<string, DraftAnswer>>;
  sent: Record<string, string>;
}

export function collectProgress(reviews: ReviewStateFile, exportedAt: string): ProgressFile {
  const drafts: ProgressFile["drafts"] = {};
  if (typeof localStorage !== "undefined") {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("preceptorat.draft.")) continue;
      drafts[key.slice("preceptorat.draft.".length)] = readJson(key, {});
    }
  }
  return {
    schema_version: "1.0",
    exported_at: exportedAt,
    reviews,
    pending: readPending(),
    history: readHistory(),
    drafts,
    sent: readSentMap(),
  };
}

export function applyProgress(file: ProgressFile): ReviewStateFile {
  writeJson(REVIEWS_KEY, file.reviews);
  writeJson(PENDING_KEY, file.pending ?? []);
  writeJson(HISTORY_KEY, file.history ?? []);
  writeJson(SENT_KEY, file.sent ?? {});
  if (typeof localStorage !== "undefined") {
    const stale: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("preceptorat.draft.")) stale.push(key);
    }
    for (const key of stale) localStorage.removeItem(key);
    for (const [id, draft] of Object.entries(file.drafts ?? {})) writeJson(`preceptorat.draft.${id}`, draft);
  }
  return file.reviews;
}

export function isProgressFile(value: unknown): value is ProgressFile {
  if (!value || typeof value !== "object") return false;
  const file = value as ProgressFile;
  return file.schema_version === "1.0" && Boolean(file.reviews && file.reviews.cards);
}
