import type { Lesson, LessonQuestion } from "./types";

export function selectTonightLesson(lessons: Lesson[], today: string): Lesson | null {
  const eligible = lessons.filter((lesson) => lesson.date <= today);
  eligible.sort((a, b) => b.date.localeCompare(a.date) || b.lesson_number - a.lesson_number);
  return eligible[0] ?? null;
}

export function pastLessons(lessons: Lesson[], today: string): Lesson[] {
  return lessons
    .filter((lesson) => lesson.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
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
