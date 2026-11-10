import { State } from "ts-fsrs";
import { mauritiusEvening } from "./dates";
import { emptyStored, round4 } from "./scheduler";
import type { CatalogCard, ReviewStateFile, StoredCard } from "./types";
import { SCHEDULER_ID } from "./scheduler";

export function legacyToStored(card: CatalogCard): StoredCard {
  const legacy = card.legacy;
  if (!legacy || (legacy.reps === 0 && !legacy.last_review)) {
    const due = mauritiusEvening(legacy?.next_review ?? card.created);
    return emptyStored(due, `${card.created}T00:00:00.000Z`);
  }
  const due = mauritiusEvening(legacy.next_review);
  const last = legacy.last_review ? mauritiusEvening(legacy.last_review) : undefined;
  const scheduled = last ? Math.max(0, Math.round((due.getTime() - last.getTime()) / 86400000)) : 0;
  let state = State.Review;
  if (legacy.level <= 0 && legacy.lapses > 0) state = State.Relearning;
  else if (legacy.level <= 0) state = State.Learning;
  const difficulty = Math.min(10, Math.max(1, round4(5 + legacy.lapses * 0.7 - Math.max(0, legacy.reps - legacy.lapses) * 0.15)));
  return {
    due: due.toISOString(),
    stability: round4(Math.max(0.5, scheduled || 1)),
    difficulty,
    elapsed_days: 0,
    scheduled_days: scheduled,
    learning_steps: 0,
    reps: legacy.reps,
    lapses: legacy.lapses,
    state,
    last_review: last?.toISOString(),
    updated_at: (last ?? due).toISOString(),
  };
}

export function stateFromCatalog(cards: CatalogCard[], updatedAt: string): ReviewStateFile {
  const stored: Record<string, StoredCard> = {};
  for (const card of cards) stored[card.id] = legacyToStored(card);
  return {
    schema_version: "1.0",
    scheduler: SCHEDULER_ID,
    updated_at: updatedAt,
    cards: stored,
  };
}
