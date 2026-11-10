import type { DraftAnswer, Lesson } from "./types";
import { lessonQuestions } from "./lessons";

export function formatAnswerComment(lesson: Lesson, drafts: Record<string, DraftAnswer>, elapsedMin: number | null): string {
  const lines = [
    "<!-- sebastien -->",
    "",
    `Réponses de Sébastien, leçon ${lesson.id}.`,
  ];
  if (elapsedMin !== null) lines.push(`Temps passé : ${elapsedMin} min.`);
  lines.push("");
  for (const question of lessonQuestions(lesson)) {
    const draft = drafts[question.code];
    const text = draft?.text.trim() ?? "";
    let value = text;
    if (!value && draft?.skipped) value = "(passée)";
    if (!value) value = "(sans réponse)";
    lines.push(`**${question.code}.** ${value}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function answerStats(lesson: Lesson, drafts: Record<string, DraftAnswer>): { filled: number; skipped: number; empty: number } {
  let filled = 0;
  let skipped = 0;
  let empty = 0;
  for (const question of lessonQuestions(lesson)) {
    const draft = drafts[question.code];
    if (draft?.text.trim()) filled += 1;
    else if (draft?.skipped) skipped += 1;
    else empty += 1;
  }
  return { filled, skipped, empty };
}

export function canReveal(draft: DraftAnswer | undefined): boolean {
  if (!draft) return false;
  return draft.skipped || draft.text.trim().length > 0;
}
