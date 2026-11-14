import type { DraftAnswer, LessonQuestion, QuestionResponse, ResponseType, SelfJudgment } from "./types";

export const INSTRUCTION_PATTERN = new RegExp(
  ["fil", " de discussion|réponds dans le ", "fil", "|", "précéder", " chaque réponse|fais ", "précéder", "|", "code", " de la question"].join(""),
  "i",
);

export function hasThreadInstruction(value: unknown): boolean {
  if (typeof value === "string") return INSTRUCTION_PATTERN.test(value);
  if (Array.isArray(value)) return value.some((item) => hasThreadInstruction(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => hasThreadInstruction(item));
  return false;
}

export function inferResponse(question: LessonQuestion): QuestionResponse {
  if (question.response) return question.response;
  const type: ResponseType =
    question.kind === "prequestion"
      ? "prediction"
      : question.kind === "reflection" || question.kind === "secondary" || question.kind === "feedback"
        ? "long"
        : question.kind === "worked"
          ? "long"
          : "court";
  return {
    type,
    confidence: question.kind === "prequestion" ? true : undefined,
  };
}

export function scaffoldOf(question: LessonQuestion): "resolu" | "guide" | "autonome" {
  if (question.kind === "worked") return "resolu";
  if (question.kind === "complete") return "guide";
  return "autonome";
}

export function answerText(draft: DraftAnswer | undefined): string {
  if (!draft) return "";
  if (draft.choice) return draft.choice;
  if (draft.order?.length) return draft.order.join(" puis ");
  if (draft.pairs && Object.keys(draft.pairs).length) {
    return Object.entries(draft.pairs)
      .map(([left, right]) => `${left} : ${right}`)
      .join(" ; ");
  }
  return draft.text.trim();
}

export function hasAttempt(draft: DraftAnswer | undefined): boolean {
  return answerText(draft).length > 0;
}

export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, "").replace(/%/g, "").replace(",", ".");
  if (!/^[-+]?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export function checkAnswer(question: LessonQuestion, draft: DraftAnswer | undefined): "juste" | "faux" | null {
  if (!draft) return null;
  const spec = inferResponse(question);
  if (spec.type === "choix") {
    if (!draft.choice || typeof spec.expected !== "string") return null;
    return draft.choice === spec.expected ? "juste" : "faux";
  }
  if (spec.type === "vrai_faux") {
    if (draft.choice !== "oui" && draft.choice !== "non") return null;
    if (typeof spec.expected !== "boolean") return null;
    const saidYes = draft.choice === "oui";
    return saidYes === spec.expected ? "juste" : "faux";
  }
  if (spec.type === "nombre") {
    if (typeof spec.expected !== "number") return null;
    const value = parseNumber(draft.text);
    if (value === null) return null;
    const tolerance = spec.tolerance ?? 0.001;
    return Math.abs(value - spec.expected) <= tolerance ? "juste" : "faux";
  }
  if (spec.type === "ordre") {
    const items = spec.items ?? [];
    if (!draft.order || draft.order.length !== items.length) return null;
    return sameList(draft.order, items) ? "juste" : "faux";
  }
  if (spec.type === "appariement") {
    const pairs = spec.pairs ?? [];
    if (!draft.pairs || Object.keys(draft.pairs).length !== pairs.length) return null;
    const ok = pairs.every((pair) => draft.pairs?.[pair.left] === pair.right);
    return ok ? "juste" : "faux";
  }
  return null;
}

export function judgmentGrade(judgment: SelfJudgment | "juste" | "faux"): "again" | "hard" | "good" {
  if (judgment === "juste") return "good";
  if (judgment === "partiel") return "hard";
  return "again";
}

export function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  const copy = [...items];
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  for (let index = copy.length - 1; index > 0; index -= 1) {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    const swap = (hash >>> 0) % (index + 1);
    const current = copy[index];
    copy[index] = copy[swap];
    copy[swap] = current;
  }
  if (copy.length > 1 && copy.every((item, index) => item === items[index])) {
    const first = copy[0];
    copy[0] = copy[1];
    copy[1] = first;
  }
  return copy;
}

export function explanationOf(question: LessonQuestion): string {
  return inferResponse(question).explanation || question.solution;
}
