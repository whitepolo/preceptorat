import type { CardCatalog, Lesson, ProgressionFile, ReviewStateFile } from "./lib/types";
import catalogJson from "../content/cartes.json";
import programmeJson from "../content/programme.json";
import bibliothequeJson from "../content/bibliotheque.json";
import progressionJson from "../content/progression.json";
import seedJson from "../content/etat/revisions.json";

const lessonModules = import.meta.glob("../content/lecons/*.json", { eager: true });

export const lessons: Lesson[] = Object.values(lessonModules)
  .map((mod) => (mod as { default: Lesson }).default)
  .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

export const catalog = catalogJson as CardCatalog;
export const programme = programmeJson;
export const bibliotheque = bibliothequeJson;
export const progression = progressionJson as ProgressionFile;
export const seedState = seedJson as ReviewStateFile;

export interface ProgrammeLesson {
  title: string;
  date?: string;
  status: string;
  lesson_id?: string;
  mastery?: boolean;
}

export interface ProgrammeModule {
  id: string;
  title: string;
  span?: string;
  current?: boolean;
  support?: string;
  lessons: ProgrammeLesson[];
}

export interface ProgrammeSubject {
  id: string;
  label: string;
  weekday: string;
  status: string;
  position: string;
  summary: string;
  modules: ProgrammeModule[];
}

export interface ProgrammeFile {
  objective: string;
  session: { hour: string; duration_min: { min: number; max: number }; trigger: string };
  principles: string[];
  mastery_threshold: number;
  rotation: { weekday: string; subject: string; note: string }[];
  points_fragiles: { card_id: string; note: string }[];
  closed: { id: string; label: string; closed_on: string; note: string }[];
  subjects: ProgrammeSubject[];
}

export const plan = programme as unknown as ProgrammeFile;

export interface LibraryWork {
  role: "primaire" | "secondaire" | "commentaire";
  title: string;
  authors: string;
  year: string;
  cite: string;
  note?: string;
  reserve?: string;
}

export interface LibraryShelf {
  id: string;
  title: string;
  civilisation: string;
  works: LibraryWork[];
}

export const library = bibliotheque as unknown as {
  intro: string;
  shelves: LibraryShelf[];
};
