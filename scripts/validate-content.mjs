import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(join(root, "schema/lecon.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const SECTION_ORDER = [
  "rappel",
  "correction",
  "prequestions",
  "cours",
  "exemples",
  "regard",
  "exercices",
  "reflexion",
  "ticket",
];

const CODE_BY_SECTION = {
  rappel: /^R[0-9]+$/,
  correction: /^C[0-9]*$/,
  prequestions: /^P[0-9]+$/,
  cours: /^N[0-9]*$/,
  exemples: /^(X[0-9]+|Xf)$/,
  regard: /^S$/,
  exercices: /^E[0-9]+$/,
  reflexion: /^Q$/,
  ticket: /^T[0-9]+$/,
};

const KIND_BY_SECTION = {
  rappel: "recall",
  correction: "feedback",
  prequestions: "prequestion",
  cours: "notion",
  regard: "secondary",
  exercices: "exercise",
  reflexion: "reflection",
  ticket: "ticket",
};

const DASH = /[\u2014\u2013]/;

export function findDashes(value, path = "$") {
  const hits = [];
  if (typeof value === "string") {
    if (DASH.test(value)) hits.push(path);
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => hits.push(...findDashes(item, `${path}[${index}]`)));
    return hits;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) hits.push(...findDashes(item, `${path}.${key}`));
  }
  return hits;
}

export function validateLesson(lesson, filename) {
  const errors = [];
  if (!validate(lesson)) {
    for (const error of validate.errors ?? []) {
      errors.push(`${error.instancePath || "/"} ${error.message}`);
    }
  }
  if (filename && lesson.id && filename !== `${lesson.id}.json`) {
    errors.push(`le nom de fichier ${filename} ne correspond pas à l'id ${lesson.id}`);
  }
  if (lesson.id && lesson.date && lesson.subject && !String(lesson.id).startsWith(`${lesson.date}-${lesson.subject}-`)) {
    errors.push("l'id doit commencer par la date et la matière");
  }
  if (lesson.duration_min && lesson.duration_min.min > lesson.duration_min.max) {
    errors.push("duration_min.min dépasse duration_min.max");
  }
  if (lesson.subject === "classiques" && !lesson.module) {
    errors.push("une leçon de classiques doit avoir un module");
  }
  const ids = (lesson.sections ?? []).map((section) => section.id);
  let last = -1;
  for (const id of ids) {
    const index = SECTION_ORDER.indexOf(id);
    if (index === -1) errors.push(`section inconnue : ${id}`);
    else if (index < last) errors.push(`section ${id} hors de l'ordre du protocole`);
    else last = index;
  }
  if (new Set(ids).size !== ids.length) errors.push("identifiants de section en double");
  if (lesson.subject === "classiques" && !ids.includes("regard")) {
    errors.push("une leçon de classiques doit avoir la section regard");
  }
  const codes = new Set();
  for (const section of lesson.sections ?? []) {
    const questions = section.questions ?? [];
    if (!section.body && !section.excerpt && !section.secondary && questions.length === 0 && !(section.figures || []).length) {
      errors.push(`section ${section.id} vide`);
    }
    if (section.id === "regard") {
      if (!section.secondary) errors.push("la section regard doit porter un objet secondary");
      if (questions.length !== 1) errors.push("la section regard a une seule question, de code S");
    }
    for (const question of questions) {
      if (codes.has(question.code)) errors.push(`code en double : ${question.code}`);
      codes.add(question.code);
      const pattern = CODE_BY_SECTION[section.id];
      if (pattern && !pattern.test(question.code)) errors.push(`${question.code} n'est pas un code de ${section.id}`);
      if (section.id === "exemples") {
        const expected = question.code === "Xf" ? "complete" : "worked";
        if (question.kind !== expected) errors.push(`${question.code} devrait être de kind ${expected}`);
      } else if (KIND_BY_SECTION[section.id] && question.kind !== KIND_BY_SECTION[section.id]) {
        errors.push(`${question.code} devrait être de kind ${KIND_BY_SECTION[section.id]}`);
      }
      if (question.card_id && section.id !== "rappel") {
        errors.push(`card_id n'est permis que dans le rappel (${question.code})`);
      }
    }
    for (const figure of section.figures ?? []) {
      for (const row of figure.rows ?? []) {
        if (row.length !== figure.columns.length) {
          errors.push(`figure « ${figure.caption} » : une ligne n'a pas le nombre de colonnes`);
        }
      }
    }
  }
  errors.push(...findDashes(lesson).map((path) => `tiret cadratin ou demi-cadratin dans ${path}`));
  return errors;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function validateRepository(dir = root) {
  const problems = [];
  const lessonDir = join(dir, "content/lecons");
  const files = readdirSync(lessonDir).filter((name) => name.endsWith(".json"));
  if (!files.length) problems.push("aucune leçon dans content/lecons");
  for (const name of files) {
    const lesson = readJson(join(lessonDir, name));
    for (const error of validateLesson(lesson, name)) problems.push(`${name} : ${error}`);
  }
  const catalog = readJson(join(dir, "content/cartes.json"));
  if (catalog.schema_version !== "1.0" || !Array.isArray(catalog.cards)) problems.push("cartes.json invalide");
  const seen = new Set();
  for (const card of catalog.cards ?? []) {
    if (!/^[A-Z]+-[0-9]{3}$/.test(card.id)) problems.push(`carte ${card.id} : id invalide`);
    if (seen.has(card.id)) problems.push(`carte en double : ${card.id}`);
    seen.add(card.id);
    for (const key of ["subject", "subject_label", "prompt", "answer", "created", "kind"]) {
      if (!card[key]) problems.push(`carte ${card.id} : ${key} manquant`);
    }
    if (card.kind !== "notion" && card.kind !== "vocabulaire") problems.push(`carte ${card.id} : kind invalide`);
    problems.push(...findDashes(card, card.id).map((path) => `tiret interdit dans la carte ${path}`));
  }
  const state = readJson(join(dir, "content/etat/revisions.json"));
  if (state.schema_version !== "1.0" || !state.cards) problems.push("etat/revisions.json invalide");
  for (const id of Object.keys(state.cards ?? {})) {
    if (!seen.has(id)) problems.push(`état orphelin : ${id}`);
    const card = state.cards[id];
    for (const key of ["due", "stability", "difficulty", "scheduled_days", "reps", "lapses", "state", "updated_at"]) {
      if (card[key] === undefined) problems.push(`état ${id} : ${key} manquant`);
    }
  }
  for (const file of ["content/programme.json", "content/bibliotheque.json", "content/progression.json"]) {
    const data = readJson(join(dir, file));
    if (data.schema_version !== "1.0") problems.push(`${file} : schema_version`);
    problems.push(...findDashes(data).map((path) => `${file} ${path} contient un tiret interdit`));
  }
  const programme = readJson(join(dir, "content/programme.json"));
  if (!Array.isArray(programme.subjects) || !programme.subjects.length) problems.push("programme.json sans matières");
  const library = readJson(join(dir, "content/bibliotheque.json"));
  if (!Array.isArray(library.shelves) || !library.shelves.length) problems.push("bibliotheque.json sans étagères");
  walkText(join(dir, "src"), problems);
  return problems;
}

function walkText(dir, problems) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walkText(path, problems);
      continue;
    }
    if (!/\.(tsx?|css|html)$/.test(name)) continue;
    const text = readFileSync(path, "utf8");
    if (DASH.test(text)) problems.push(`${relative(root, path)} contient un tiret cadratin ou demi-cadratin`);
  }
}

const isMain = Boolean(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href);
if (isMain) {
  const problems = validateRepository();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("Contenu valide.");
}
