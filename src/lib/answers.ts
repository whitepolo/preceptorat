import type { DraftAnswer, Lesson } from "./types";
import { lessonQuestions } from "./lessons";
import { answerText } from "./response";

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
    const text = answerText(draft);
    let value = text;
    if (!value && draft?.skipped) value = "(passée)";
    if (!value) value = "(sans réponse)";
    if (draft?.confidence) {
      const labels = { devine: "je devine", peu: "peu sûr", assez: "assez sûr", sur: "sûr" };
      value += ` (confiance : ${labels[draft.confidence]})`;
    }
    if (draft?.auto) value += ` [corrigé : ${draft.auto}]`;
    else if (draft?.judgment) value += ` [auto-évaluation : ${draft.judgment}]`;
    lines.push(`**${question.code}.** ${question.prompt.split("\n")[0]}`);
    lines.push(value);
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
    if (answerText(draft)) filled += 1;
    else if (draft?.skipped) skipped += 1;
    else empty += 1;
  }
  return { filled, skipped, empty };
}

export function canReveal(draft: DraftAnswer | undefined): boolean {
  return answerText(draft).length > 0;
}
