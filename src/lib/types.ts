export type SubjectId =
  | "latin"
  | "classiques"
  | "philosophie"
  | "mathematiques"
  | "sciences"
  | "economie"
  | "econometrie"
  | "quiz"
  | "art"
  | "histoire";

export interface DurationMin {
  min: number;
  max: number;
}

export interface LessonQuestion {
  code: string;
  kind:
    | "recall"
    | "feedback"
    | "prequestion"
    | "notion"
    | "worked"
    | "complete"
    | "secondary"
    | "exercise"
    | "reflection"
    | "ticket";
  prompt: string;
  solution: string;
  card_id?: string;
}

export interface Excerpt {
  work: string;
  locus: string;
  edition: string;
  translator?: string;
  lang?: string;
  text: string;
  close_reading?: string;
}

export interface Figure {
  type: "table";
  caption: string;
  columns: string[];
  rows: string[][];
}

export interface SecondaryView {
  work: string;
  idea: string;
  question: string;
  solution: string;
}

export interface LessonSection {
  id:
    | "rappel"
    | "correction"
    | "prequestions"
    | "cours"
    | "exemples"
    | "regard"
    | "exercices"
    | "reflexion"
    | "ticket";
  title: string;
  duration_min?: DurationMin;
  body?: string;
  questions?: LessonQuestion[];
  excerpt?: Excerpt;
  figures?: Figure[];
  secondary?: SecondaryView;
}

export interface Lesson {
  schema_version: "1.0";
  id: string;
  title: string;
  date: string;
  weekday?: string;
  subject: SubjectId;
  subject_label: string;
  lesson_number: number;
  module?: { id: string; title: string };
  duration_min: DurationMin;
  lang: "fr";
  objectives: string[];
  prerequisites?: string[];
  student_note: string;
  sources?: { type: "primary" | "secondary" | "method"; cite: string }[];
  sections: LessonSection[];
  retenir: string[];
  mot_du_jour: { code: "M"; terme: string; texte: string };
}

export interface CardLegacy {
  level: number;
  last_review: string | null;
  next_review: string;
  reps: number;
  lapses: number;
  history: string;
}

export interface CatalogCard {
  id: string;
  subject: SubjectId;
  subject_label: string;
  prompt: string;
  answer: string;
  created: string;
  kind: "notion" | "vocabulaire";
  legacy?: CardLegacy;
}

export interface CardCatalog {
  schema_version: "1.0";
  cards: CatalogCard[];
}

export interface StoredCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
  updated_at: string;
}

export interface ReviewStateFile {
  schema_version: "1.0";
  scheduler: string;
  updated_at: string;
  cards: Record<string, StoredCard>;
}

export type GradeName = "again" | "hard" | "good" | "easy";

export interface DraftAnswer {
  text: string;
  skipped: boolean;
  revealed: boolean;
}

export interface Activity {
  date: string;
  kind: "leçon" | "réponses";
  summary: string;
}

export interface ProgressionFile {
  schema_version: "1.0";
  activities: Activity[];
  entries: { date: string; text: string }[];
}
