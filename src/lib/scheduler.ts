import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type Grade,
} from "ts-fsrs";
import type { GradeName, StoredCard } from "./types";

export const SCHEDULER_ID = "fsrs-6";

const engine = fsrs(
  generatorParameters({
    request_retention: 0.9,
    enable_fuzz: false,
    enable_short_term: true,
    maximum_interval: 365,
  }),
);

const RATINGS: Record<GradeName, Grade> = {
  again: Rating.Again as Grade,
  hard: Rating.Hard as Grade,
  good: Rating.Good as Grade,
  easy: Rating.Easy as Grade,
};

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function toStored(card: Card, updatedAt: string): StoredCard {
  const stored: StoredCard = {
    due: card.due.toISOString(),
    stability: round4(card.stability),
    difficulty: round4(card.difficulty),
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    updated_at: updatedAt,
  };
  if (card.last_review) stored.last_review = card.last_review.toISOString();
  return stored;
}

export function toCard(stored: StoredCard): Card {
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsed_days,
    scheduled_days: stored.scheduled_days,
    learning_steps: stored.learning_steps,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state,
    last_review: stored.last_review ? new Date(stored.last_review) : undefined,
  };
}

export function emptyStored(due: Date, updatedAt: string): StoredCard {
  return toStored(createEmptyCard(due), updatedAt);
}

export function applyGrade(stored: StoredCard, grade: GradeName, now: Date): StoredCard {
  const result = engine.next(toCard(stored), now, RATINGS[grade]);
  return toStored(result.card, now.toISOString());
}

export function previewIntervals(stored: StoredCard, now: Date): Record<GradeName, string> {
  const preview = engine.repeat(toCard(stored), now);
  const names: GradeName[] = ["again", "hard", "good", "easy"];
  const out = {} as Record<GradeName, string>;
  for (const name of names) {
    const item = preview[RATINGS[name]];
    const minutes = Math.round((item.card.due.getTime() - now.getTime()) / 60000);
    out[name] = labelFromMinutes(minutes);
  }
  return out;
}

function labelFromMinutes(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 20) return hours === 1 ? "1 h" : `${hours} h`;
  const days = Math.max(1, Math.round(minutes / 1440));
  return days === 1 ? "1 j" : `${days} j`;
}

export function sameCard(a: StoredCard, b: StoredCard): boolean {
  return JSON.stringify(normalizeCard(a)) === JSON.stringify(normalizeCard(b));
}

function normalizeCard(card: StoredCard): StoredCard {
  return {
    ...card,
    stability: round4(card.stability),
    difficulty: round4(card.difficulty),
  };
}
