import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { catalog, seedState } from "./content";
import { mauritiusDate, mauritiusEvening } from "./lib/dates";
import { applyGrade, emptyStored } from "./lib/scheduler";
import { isSameEvening, selectSession, type SessionPlan } from "./lib/session";
import { loadReviewState, pushReviewState, writeLocalState } from "./lib/sync";
import { readToken, subscribePrefs } from "./lib/prefs";
import type { GradeName, ReviewStateFile } from "./lib/types";

interface ReviewContextValue {
  state: ReviewStateFile;
  ready: boolean;
  status: string;
  today: string;
  plan: SessionPlan;
  queue: string[];
  grade: (id: string, gradeName: GradeName) => Promise<void>;
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
  const [token, setToken] = useState(readToken);
  const [state, setState] = useState<ReviewStateFile>(seedState);
  const [sha, setSha] = useState<string | null>(null);
  const [status, setStatus] = useState("Chargement des révisions.");
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(() => mauritiusDate());
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => subscribePrefs(() => setToken(readToken())), []);

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
    const result = await loadReviewState(seedState, token || undefined);
    setState(result.state);
    setSha(result.sha);
    setStatus(result.message);
    setReady(true);
    const stored = readQueue(day);
    if (stored) setQueue(stored);
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
  }, [token]);

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
      writeLocalState(nextState, sha);
      if (!token) {
        setStatus("Enregistré sur cet appareil. Le jeton synchronisera téléphone et ordinateur.");
        return;
      }
      const result = await pushReviewState(nextState, token, sha);
      setState(result.state);
      setSha(result.sha);
      setStatus(result.message);
    },
    [queue, sha, state, token],
  );

  const value = useMemo(
    () => ({ state, ready, status, today, plan, queue, grade, reload }),
    [state, ready, status, today, plan, queue, grade, reload],
  );

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReviews(): ReviewContextValue {
  const value = useContext(ReviewContext);
  if (!value) throw new Error("Contexte des révisions absent.");
  return value;
}
