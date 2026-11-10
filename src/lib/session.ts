import { endOfMauritiusDay } from "./dates";

export interface SessionCard {
  id: string;
  subject: string;
  kind: "notion" | "vocabulaire";
  due: string;
  created: string;
  reps: number;
}

export interface SessionPlan {
  ids: string[];
  dueTotal: number;
  deferred: number;
}

function compareCard(a: SessionCard, b: SessionCard): number {
  const due = Date.parse(a.due) - Date.parse(b.due);
  if (due) return due;
  const created = a.created.localeCompare(b.created);
  if (created) return created;
  return a.id.localeCompare(b.id);
}

export function selectSession(cards: SessionCard[], today: string, limit = 8): SessionPlan {
  const end = endOfMauritiusDay(today).getTime();
  const due = cards.filter((card) => Date.parse(card.due) <= end);
  const bySubject = new Map<string, SessionCard[]>();
  for (const card of due) {
    const list = bySubject.get(card.subject) ?? [];
    list.push(card);
    bySubject.set(card.subject, list);
  }
  for (const list of bySubject.values()) list.sort(compareCard);
  const subjects = [...bySubject.keys()].sort((a, b) => {
    const delta = Date.parse(bySubject.get(a)![0].due) - Date.parse(bySubject.get(b)![0].due);
    return delta || a.localeCompare(b, "fr");
  });
  const picked: SessionCard[] = [];
  while (picked.length < limit) {
    let progressed = false;
    for (const subject of subjects) {
      const list = bySubject.get(subject)!;
      if (!list.length) continue;
      picked.push(list.shift()!);
      progressed = true;
      if (picked.length >= limit) break;
    }
    if (!progressed) break;
  }
  const freshVocab = (card: SessionCard) => card.kind === "vocabulaire" && card.reps === 0;
  const rest = picked.filter((card) => !freshVocab(card));
  const fresh = picked.filter(freshVocab);
  return {
    ids: [...rest.map((card) => card.id), ...fresh.map((card) => card.id)],
    dueTotal: due.length,
    deferred: Math.max(0, due.length - picked.length),
  };
}

export function isSameEvening(dueIso: string, now: Date, withinMinutes = 20): boolean {
  return Date.parse(dueIso) - now.getTime() <= withinMinutes * 60000;
}
