import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { catalog, seedState } from "./content";
import { mauritiusDate, mauritiusEvening } from "./lib/dates";
import { applyGrade, emptyStored } from "./lib/scheduler";
import { isSameEvening, selectSession, type SessionPlan } from "./lib/session";
import { clearPending, readPending, recordGrade } from "./lib/localProgress";
import type { GradeEvent } from "./lib/issueLink";
import { loadReviewState, writeLocalState } from "./lib/sync";
import type { GradeName, ReviewStateFile } from "./lib/types";

function allowedCardIds(): Set<string> {
  return new Set(catalog.cards.map((card) => card.id));
}

interface ReviewContextValue {
  state: ReviewStateFile;
  ready: boolean;
  status: string;
  today: string;
  plan: SessionPlan;
  queue: string[];
  pending: GradeEvent[];
  grade: (id: string, gradeName: GradeName) => Promise<void>;
  markReviewsSent: () => void;
  replaceState: (next: ReviewStateFile) => void;
  reload: () => Promise<void>;
}

const ReviewContext = createContext<ReviewContextValue | null>(null);

function queueKey(today: string): string {
  return `preceptorat.queue.${today}`;
}

function readQueue(today: string): string[] | null {
  const raw = localStorage.getItem(queueKey(today));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReviewStateFile>(seedState);
  const [pending, setPending] = useState<GradeEvent[]>(() => readPending());
  const [status, setStatus] = useState("Chargement des révisions.");
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(() => mauritiusDate());
  const [queue, setQueue] = useState<string[]>([]);

  const plan = useMemo(() => {
    const cards = catalog.cards.map((card) => {
      const stored = state.cards[card.id];
      const due = stored?.due ?? mauritiusEvening(card.legacy?.next_review ?? card.created).toISOString();
      return {
        id: card.id,
        subject: card.subject,
        kind: card.kind,
        due,
        created: card.created,
        reps: stored?.reps ?? 0,
      };
    });
    return selectSession(cards, today);
  }, [state, today]);

  const reload = useCallback(async () => {
    const day = mauritiusDate();
    setToday(day);
    const allowed = allowedCardIds();
    const waiting = new Set(readPending().map((item) => item.card_id));
    const result = await loadReviewState(seedState, allowed, waiting);
    setState(result.state);
    setPending(readPending());
    setStatus(result.message);
    setReady(true);
    const stored = readQueue(day);
    const storedIsCurrent = stored !== null && stored.every((id) => allowed.has(id));
    if (storedIsCurrent && stored) setQueue(stored);
    else {
      const cards = catalog.cards.map((card) => {
        const saved = result.state.cards[card.id];
        return {
          id: card.id,
          subject: card.subject,
          kind: card.kind,
          due: saved?.due ?? mauritiusEvening(card.legacy?.next_review ?? card.created).toISOString(),
          created: card.created,
          reps: saved?.reps ?? 0,
        };
      });
      const next = selectSession(cards, day).ids;
      localStorage.setItem(queueKey(day), JSON.stringify(next));
      setQueue(next);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const grade = useCallback(
    async (id: string, gradeName: GradeName) => {
      const now = new Date();
      const current = state.cards[id] ?? emptyStored(now, now.toISOString());
      const nextCard = applyGrade(current, gradeName, now);
      const nextState: ReviewStateFile = {
        ...state,
        updated_at: now.toISOString(),
        cards: { ...state.cards, [id]: nextCard },
      };
      const day = mauritiusDate(now);
      const remaining = queue.filter((item) => item !== id);
      if (isSameEvening(nextCard.due, now)) remaining.push(id);
      setState(nextState);
      setQueue(remaining);
      localStorage.setItem(queueKey(day), JSON.stringify(remaining));
      writeLocalState(nextState);
      const nextPending = recordGrade(id, gradeName, now.toISOString());
      setPending(nextPending);
      const count = nextPending.length;
      setStatus(count === 1 ? "1 révision pas encore envoyée." : `${count} révisions pas encore envoyées.`);
    },
    [queue, state],
  );

  const markReviewsSent = useCallback(() => {
    clearPending();
    setPending([]);
    setStatus("Révisions prêtes à être déposées sur GitHub.");
  }, []);

  const replaceState = useCallback((next: ReviewStateFile) => {
    const pruned = { ...next, cards: Object.fromEntries(Object.entries(next.cards).filter(([id]) => allowedCardIds().has(id))) };
    writeLocalState(pruned);
    setState(pruned);
    setPending(readPending());
  }, []);

  const value = useMemo(
    () => ({ state, ready, status, today, plan, queue, pending, grade, markReviewsSent, replaceState, reload }),
    [state, ready, status, today, plan, queue, pending, grade, markReviewsSent, replaceState, reload],
  );

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReviews(): ReviewContextValue {
  const value = useContext(ReviewContext);
  if (!value) throw new Error("Contexte des révisions absent.");
  return value;
}
