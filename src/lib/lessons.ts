import { readSentMap } from "./localProgress";
import { hasAttempt } from "./response";
import type { DraftAnswer, Excerpt, Lesson, LessonQuestion } from "./types";

export function selectTonightLesson(lessons: Lesson[], today: string): Lesson | null {
  const eligible = lessons.filter((lesson) => lesson.date <= today);
  eligible.sort((a, b) => b.date.localeCompare(a.date) || b.lesson_number - a.lesson_number);
  return eligible[0] ?? null;
}

export function lessonForToday(lessons: Lesson[], today: string): Lesson | null {
  const sameDay = lessons.filter((lesson) => lesson.date === today);
  sameDay.sort((a, b) => b.lesson_number - a.lesson_number || b.id.localeCompare(a.id));
  return sameDay[0] ?? null;
}

export function pastLessons(lessons: Lesson[], today: string): Lesson[] {
  return lessons
    .filter((lesson) => lesson.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function lessonHash(id: string): string {
  return `#/lecon/${encodeURIComponent(id)}`;
}

export function parseLessonId(hash: string): string | null {
  const match = /^#\/lecon\/([^/?#]+)/.exec(hash.trim());
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function accessibleLesson(lessons: Lesson[], id: string, today: string): Lesson | null {
  return lessons.find((lesson) => lesson.id === id && lesson.date <= today) ?? null;
}

export function lessonOnDate(lessons: Lesson[], date: string): Lesson | null {
  const same = lessons.filter((lesson) => lesson.date === date);
  same.sort((a, b) => b.lesson_number - a.lesson_number || b.id.localeCompare(a.id));
  return same[0] ?? null;
}

export function lessonStepCount(lesson: Lesson): number {
  const further = lesson.pour_aller_plus_loin?.length ? 1 : 0;
  return 1 + lesson.sections.length + 1 + further + 2;
}

export interface LessonReadState {
  kind: "envoyée" | "terminée" | "en cours" | "non commencée";
  percent: number;
  label: string;
}

export function lessonReadState(input: {
  questions: number;
  attempted: number;
  step: number;
  steps: number;
  sent: boolean;
}): LessonReadState {
  const percent = input.questions ? Math.round((input.attempted / input.questions) * 100) : 0;
  if (input.sent) return { kind: "envoyée", percent, label: "envoyée" };
  const finished =
    (input.questions > 0 && input.attempted >= input.questions) ||
    (input.steps > 1 && input.step >= input.steps - 1 && input.attempted > 0);
  if (finished) return { kind: "terminée", percent: 100, label: "terminée" };
  if (input.attempted > 0 || input.step > 0) return { kind: "en cours", percent, label: `en cours, ${percent} %` };
  return { kind: "non commencée", percent: 0, label: "non commencée" };
}

export function loadLessonReadState(lesson: Lesson): LessonReadState {
  let drafts: Record<string, DraftAnswer> = {};
  let step = 0;
  try {
    const raw = localStorage.getItem(`preceptorat.draft.${lesson.id}`);
    if (raw) drafts = JSON.parse(raw) as Record<string, DraftAnswer>;
    step = Number(localStorage.getItem(`preceptorat.step.${lesson.id}`) ?? "0") || 0;
  } catch {
    drafts = {};
  }
  const questions = lessonQuestions(lesson);
  const attempted = questions.filter((question) => {
    const draft = drafts[question.code];
    return Boolean(draft && (hasAttempt(draft) || draft.skipped));
  }).length;
  return lessonReadState({
    questions: questions.length,
    attempted,
    step,
    steps: lessonStepCount(lesson),
    sent: Boolean(readSentMap()[`reponses:${lesson.id}`]),
  });
}

export function excerptSides(excerpt: Excerpt): { original?: string; translation: string; reading?: string } {
  if (excerpt.original) {
    return { original: excerpt.original, translation: excerpt.text, reading: excerpt.close_reading };
  }
  const greek = excerpt.text.split("\n\nTexte grec : ");
  if (greek.length === 2) {
    return { original: greek[1].trim(), translation: greek[0].trim(), reading: excerpt.close_reading };
  }
  if (excerpt.lang === "la" && excerpt.close_reading?.startsWith("Traduction")) {
    const [first, ...rest] = excerpt.close_reading.split("\n\n");
    const translation = first.replace(/^Traduction de travail\s*:\s*/, "").trim();
    return { original: excerpt.text, translation, reading: rest.join("\n\n") || undefined };
  }
  return { translation: excerpt.text, reading: excerpt.close_reading };
}

export function lessonQuestions(lesson: Lesson): LessonQuestion[] {
  return lesson.sections.flatMap((section) => section.questions ?? []);
}

export function subjectLabel(subject: string): string {
  const labels: Record<string, string> = {
    latin: "Latin",
    classiques: "Classiques",
    philosophie: "Philosophie",
    mathematiques: "Mathématiques",
    sciences: "Sciences",
    economie: "Économie",
    econometrie: "Économétrie",
    quiz: "Quiz",
    art: "Art",
    histoire: "Histoire",
  };
  return labels[subject] ?? subject;
}
