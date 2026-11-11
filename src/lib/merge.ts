import type { ReviewStateFile, StoredCard } from "./types";
import { SCHEDULER_ID } from "./scheduler";

export function emptyState(now = new Date()): ReviewStateFile {
  return {
    schema_version: "1.0",
    scheduler: SCHEDULER_ID,
    updated_at: now.toISOString(),
    cards: {},
  };
}

export function pickCard(a: StoredCard, b: StoredCard): StoredCard {
  const ta = Date.parse(a.updated_at);
  const tb = Date.parse(b.updated_at);
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta > tb ? a : b;
  if (a.reps !== b.reps) return a.reps > b.reps ? a : b;
  const dueA = Date.parse(a.due);
  const dueB = Date.parse(b.due);
  if (dueA !== dueB) return dueA > dueB ? a : b;
  if (a.lapses !== b.lapses) return a.lapses > b.lapses ? a : b;
  return a;
}

export function mergeStates(a: ReviewStateFile, b: ReviewStateFile): ReviewStateFile {
  const ids = new Set([...Object.keys(a.cards), ...Object.keys(b.cards)]);
  const cards: Record<string, StoredCard> = {};
  let latest = Math.max(Date.parse(a.updated_at) || 0, Date.parse(b.updated_at) || 0);
  for (const id of ids) {
    const left = a.cards[id];
    const right = b.cards[id];
    const chosen = !left ? right : !right ? left : pickCard(left, right);
    cards[id] = chosen;
    const stamp = Date.parse(chosen.updated_at);
    if (Number.isFinite(stamp)) latest = Math.max(latest, stamp);
  }
  return {
    schema_version: "1.0",
    scheduler: SCHEDULER_ID,
    updated_at: new Date(latest || Date.now()).toISOString(),
    cards,
  };
}

export function pruneUnknownCards(state: ReviewStateFile, allowed: ReadonlySet<string>): ReviewStateFile {
  const cards: Record<string, StoredCard> = {};
  for (const [id, card] of Object.entries(state.cards)) {
    if (allowed.has(id)) cards[id] = card;
  }
  if (Object.keys(cards).length === Object.keys(state.cards).length) return state;
  return { ...state, cards };
}

export function statesEqual(a: ReviewStateFile, b: ReviewStateFile): boolean {
  const ids = new Set([...Object.keys(a.cards), ...Object.keys(b.cards)]);
  for (const id of ids) {
    if (!a.cards[id] || !b.cards[id]) return false;
    if (JSON.stringify(a.cards[id]) !== JSON.stringify(b.cards[id])) return false;
  }
  return true;
}
