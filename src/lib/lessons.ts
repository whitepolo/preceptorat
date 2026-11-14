import type { Excerpt, Lesson, LessonQuestion } from "./types";

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
