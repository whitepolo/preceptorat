import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { State } from "ts-fsrs";
import { lessons, seedState } from "../content";
import { canReveal, formatAnswerComment } from "./answers";
import { stateFromCatalog } from "./legacy";
import { mauritiusDate } from "./dates";
import { buildIssueLinks, deflateBase64, inflateBase64, ISSUE_URL_LIMIT } from "./issueLink";
import { lessonForToday, selectTonightLesson } from "./lessons";
import { applyProgress, collectProgress, isProgressFile, recordGrade } from "./localProgress";
import { isTutorMessage, renderMarkdown, stripTutorMarker } from "./markdown";
import { mergeStates, mergeWithPending, pickCard, pruneUnknownCards } from "./merge";
import { applyGrade } from "./scheduler";
import { selectSession } from "./session";
import type { Lesson, ReviewStateFile, StoredCard } from "./types";

function fixtureLesson(id: string, date: string, codes: string[]): Lesson {
  return {
    schema_version: "1.0",
    id,
    title: `${date} · Latin · Leçon 1 : fixture`,
    date,
    subject: "latin",
    subject_label: "Latin",
    lesson_number: 1,
    duration_min: { min: 30, max: 45 },
    lang: "fr",
    objectives: ["Lire", "Écrire"],
    student_note: "Réponds avant la solution.",
    sections: [
      {
        id: "prequestions",
        title: "Avant de lire",
        questions: codes.map((code) => ({ code, kind: "prequestion", prompt: "Question", solution: "Réponse" })),
      },
    ],
    retenir: ["Une phrase.", "Deux.", "Trois.", "Quatre."],
    mot_du_jour: { code: "M", terme: "fixture", texte: "Mot d'essai." },
  };
}

const FIXTURES = [
  fixtureLesson("2026-01-01-latin-L1", "2026-01-01", ["P1"]),
  fixtureLesson("2026-01-03-latin-L2", "2026-01-03", ["P1", "P2"]),
];

function memoryStorage(): void {
  const store = new Map<string, string>();
  const localStorage = {
    get length() {
      return store.size;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: localStorage, configurable: true });
}

describe("leçon du jour", () => {
  it("n'ouvre que la leçon datée du jour, et garde la plus récente pour le lien", () => {
    expect(lessonForToday(FIXTURES, "2026-01-01")?.id).toBe("2026-01-01-latin-L1");
    expect(lessonForToday(FIXTURES, "2026-01-02")).toBeNull();
    expect(lessonForToday(FIXTURES, "2026-01-03")?.id).toBe("2026-01-03-latin-L2");
    expect(selectTonightLesson(FIXTURES, "2026-01-02")?.id).toBe("2026-01-01-latin-L1");
    expect(selectTonightLesson(FIXTURES, "2026-01-04")?.id).toBe("2026-01-03-latin-L2");
  });

  it("affiche une leçon dès sa date civile, matin ou après-midi", () => {
    const early = new Date("2026-01-03T02:30:00.000Z");
    const morning = new Date("2026-01-03T03:30:00.000Z");
    const afternoon = new Date("2026-01-03T12:00:00.000Z");
    for (const instant of [early, morning, afternoon]) {
      expect(mauritiusDate(instant)).toBe("2026-01-03");
      expect(lessonForToday(FIXTURES, mauritiusDate(instant))?.id).toBe("2026-01-03-latin-L2");
    }
  });
});

describe("fusion des révisions", () => {
  const base = (patch: Partial<StoredCard>): StoredCard => ({
    due: "2026-11-12T15:00:00.000Z",
    stability: 4,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 4,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    state: State.Review,
    updated_at: "2026-11-10T15:00:00.000Z",
    ...patch,
  });

  it("oublie une carte qui n'est plus au catalogue, même si le cache la contient", () => {
    const orphan = base({ reps: 4, updated_at: "2026-11-12T15:00:00.000Z" });
    const kept = base({ reps: 1, updated_at: "2026-11-10T15:00:00.000Z" });
    const merged = pruneUnknownCards(
      mergeStates(
        { schema_version: "1.0", scheduler: "fsrs-6", updated_at: "2026-11-12T15:00:00.000Z", cards: { "HIS-001": orphan, "LAT-001": kept } },
        { schema_version: "1.0", scheduler: "fsrs-6", updated_at: "2026-11-01T15:00:00.000Z", cards: {} },
      ),
      new Set(["LAT-001"]),
    );
    expect(merged.cards["HIS-001"]).toBeUndefined();
    expect(merged.cards["LAT-001"].reps).toBe(1);
  });

  it("garde la carte la plus récente et réunit les identifiants", () => {
    const left: ReviewStateFile = {
      schema_version: "1.0",
      scheduler: "fsrs-6",
      updated_at: "2026-11-10T15:00:00.000Z",
      cards: { "LAT-001": base({ reps: 2, updated_at: "2026-11-11T15:00:00.000Z" }) },
    };
    const right: ReviewStateFile = {
      schema_version: "1.0",
      scheduler: "fsrs-6",
      updated_at: "2026-11-09T15:00:00.000Z",
      cards: {
        "LAT-001": base({ reps: 1, updated_at: "2026-11-09T15:00:00.000Z" }),
        "HIS-001": base({ reps: 3, updated_at: "2026-11-08T15:00:00.000Z" }),
      },
    };
    const merged = mergeStates(left, right);
    expect(merged.cards["LAT-001"].reps).toBe(2);
    expect(merged.cards["HIS-001"].reps).toBe(3);
  });

  it("à horloge égale, garde le plus grand nombre de répétitions", () => {
    const chosen = pickCard(base({ reps: 1 }), base({ reps: 4, due: "2026-11-01T15:00:00.000Z" }));
    expect(chosen.reps).toBe(4);
  });

  it("garde une notation locale pas encore envoyée, même si le dépôt est plus récent", () => {
    const localCard = base({ reps: 2, updated_at: "2026-11-10T15:00:00.000Z", difficulty: 4 });
    const remoteCard = base({ reps: 9, updated_at: "2026-11-12T15:00:00.000Z", difficulty: 8 });
    const local: ReviewStateFile = {
      schema_version: "1.0",
      scheduler: "fsrs-6",
      updated_at: "2026-11-10T15:00:00.000Z",
      cards: { "LAT-001": localCard },
    };
    const remote: ReviewStateFile = {
      schema_version: "1.0",
      scheduler: "fsrs-6",
      updated_at: "2026-11-12T15:00:00.000Z",
      cards: { "LAT-001": remoteCard },
    };
    const pending = mergeWithPending(local, remote, new Set(["LAT-001"]));
    expect(pending.cards["LAT-001"].reps).toBe(2);
    const sent = mergeWithPending(local, remote, new Set());
    expect(sent.cards["LAT-001"].reps).toBe(9);
  });
});

describe("FSRS", () => {
  const card: StoredCard = {
    due: "2026-11-11T15:00:00.000Z",
    stability: 6,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 6,
    learning_steps: 0,
    reps: 2,
    lapses: 0,
    state: State.Review,
    last_review: "2026-11-06T15:00:00.000Z",
    updated_at: "2026-11-06T15:00:00.000Z",
  };
  const now = new Date("2026-11-11T16:00:00.000Z");

  it("rapproche À revoir et éloigne Correct", () => {
    const again = applyGrade(card, "again", now);
    const good = applyGrade(card, "good", now);
    expect(Date.parse(again.due)).toBeLessThan(Date.parse(good.due));
    expect(again.lapses).toBe(1);
    expect(good.reps).toBe(3);
    expect(good.updated_at).toBe(now.toISOString());
  });

  it("part d'un état vide quand le catalogue n'a pas encore de cartes", () => {
    expect(seedState.schema_version).toBe("1.0");
    expect(stateFromCatalog([], "2026-01-01T00:00:00.000Z").cards).toEqual({});
  });
});

describe("séance du jour", () => {
  it("mélange les matières et groupe le vocabulaire jamais revu", () => {
    const due = "2026-11-11T15:00:00.000Z";
    const cards = [
      { id: "HIS-1", subject: "histoire", kind: "notion" as const, due, created: "2026-11-05", reps: 1 },
      { id: "LAT-A", subject: "latin", kind: "notion" as const, due, created: "2026-11-04", reps: 2 },
      { id: "LAT-B", subject: "latin", kind: "notion" as const, due, created: "2026-11-04", reps: 2 },
      { id: "LAT-V", subject: "latin", kind: "vocabulaire" as const, due, created: "2026-11-09", reps: 0 },
    ];
    const plan = selectSession(cards, "2026-11-11");
    expect(plan.dueTotal).toBe(4);
    expect(plan.ids).toEqual(["HIS-1", "LAT-A", "LAT-B", "LAT-V"]);
  });

  it("ne propose rien quand il n'y a aucune carte", () => {
    expect(selectSession([], "2026-11-11")).toEqual({ ids: [], dueTotal: 0, deferred: 0 });
  });
});

describe("réponses et markdown", () => {
  it("n'ouvre la solution qu'après une tentative", () => {
    expect(canReveal(undefined)).toBe(false);
    expect(canReveal({ text: "  ", skipped: false, revealed: false })).toBe(false);
    expect(canReveal({ text: "", skipped: true, revealed: false })).toBe(true);
    expect(canReveal({ text: "Syria", skipped: false, revealed: false })).toBe(true);
  });

  it("forme un commentaire structuré, distinct d'une réponse de Schopen", () => {
    const lesson = fixtureLesson("2026-01-03-latin-L2", "2026-01-03", ["P1", "P2"]);
    const body = formatAnswerComment(lesson, { P1: { text: "insula", skipped: false, revealed: false } }, 32);
    expect(body.startsWith("<!-- sebastien -->")).toBe(true);
    expect(isTutorMessage(body)).toBe(false);
    expect(body).toContain("**P1.** insula");
    expect(body).toContain("**P2.** (sans réponse)");
    expect(isTutorMessage("<!-- schopen -->\n\nBien.")).toBe(true);
    expect(stripTutorMarker("<!-- schopen -->\n\nBien.")).toBe("Bien.");
  });

  it("échappe le HTML et rend le gras", () => {
    const html = renderMarkdown("**<script>alert(1)</script>** et *latin*");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<strong>");
    expect(html).toContain("<em>latin</em>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("schéma", () => {
  it("exige une bibliographie pour chaque leçon à partir du 17 novembre 2026", () => {
    const recent = lessons.filter((lesson) => lesson.date >= "2026-11-17");
    expect(recent.length).toBeGreaterThan(0);
    for (const lesson of recent) {
      expect((lesson.pour_aller_plus_loin ?? []).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("accepte le dépôt", () => {
    const out = execFileSync("node", ["scripts/validate-content.mjs"], { encoding: "utf8" });
    expect(out).toContain("Contenu valide");
  });

  it("refuse un tiret cadratin", () => {
    const script = `
      import { readdirSync, readFileSync } from "node:fs";
      import { validateLesson } from "./scripts/validate-content.mjs";
      const name = readdirSync("./content/lecons").find((file) => file.endsWith(".json"));
      if (!name) process.exit(1);
      const lesson = JSON.parse(readFileSync("./content/lecons/" + name, "utf8"));
      const copy = structuredClone(lesson);
      copy.objectives[0] = "objectif " + String.fromCharCode(0x2014);
      const errors = validateLesson(copy, name);
      if (!errors.some((error) => error.includes("tiret"))) process.exit(1);
    `;
    execFileSync("node", ["--input-type=module", "-e", script], { encoding: "utf8" });
  });
});

describe("lien d'issue", () => {
  it("prépare une seule adresse, avec le marqueur et le JSON", async () => {
    const links = await buildIssueLinks({
      type: "reponses",
      lesson_id: "2026-01-03-latin-L2",
      date: "2026-01-03",
      human: "Réponses de Sébastien.\n\n**P1.** insula",
      answers: { P1: "insula" },
    });
    expect(links).toHaveLength(1);
    expect(links[0].title).toBe("Réponses 2026-01-03-latin-L2");
    const body = decodeURIComponent(links[0].url.split("body=")[1].split("&")[0].replace(/\+/g, " "));
    expect(body.startsWith("<!-- sebastien -->")).toBe(true);
    expect(body).toContain("**P1.** insula");
    expect(body).toContain('"type": "reponses"');
    expect(body).toContain('"lesson_id": "2026-01-03-latin-L2"');
    expect(links[0].url).toContain("labels=reponses");
    expect(links[0].url.length).toBeLessThanOrEqual(ISSUE_URL_LIMIT);
  });

  it("découpe ou compresse un texte trop long", async () => {
    const answers: Record<string, string> = {};
    for (let index = 0; index < 20; index += 1) answers[`X${index}`] = randomBytes(500).toString("base64");
    const links = await buildIssueLinks({
      type: "reponses",
      lesson_id: "2026-01-03-latin-L2",
      human: "Trop long.",
      answers,
    });
    expect(links.length).toBeGreaterThan(1);
    expect(links.every((link) => link.url.length <= ISSUE_URL_LIMIT)).toBe(true);
    expect(links[0].title).toContain("(1/");
    const packed = await deflateBase64("préceptorat");
    expect(await inflateBase64(packed)).toBe("préceptorat");
  });
});

describe("sauvegarde locale", () => {
  it("enregistre une notation et la retrouve dans l'export", () => {
    memoryStorage();
    const pending = recordGrade("LAT-001", "good", "2026-01-03T12:00:00.000Z");
    expect(pending).toEqual([{ card_id: "LAT-001", grade: "good", reviewed_at: "2026-01-03T12:00:00.000Z" }]);
    const reviews: ReviewStateFile = {
      schema_version: "1.0",
      scheduler: "fsrs-6",
      updated_at: "2026-01-03T12:00:00.000Z",
      cards: {},
    };
    localStorage.setItem("preceptorat.draft.2026-01-03-latin-L2", JSON.stringify({ P1: { text: "insula", skipped: false, revealed: false } }));
    const file = collectProgress(reviews, "2026-01-03T12:00:00.000Z");
    expect(isProgressFile(file)).toBe(true);
    expect(file.pending[0].card_id).toBe("LAT-001");
    expect(file.drafts["2026-01-03-latin-L2"].P1.text).toBe("insula");
    localStorage.clear();
    const restored = applyProgress(file);
    expect(restored.updated_at).toBe(reviews.updated_at);
    expect(JSON.parse(localStorage.getItem("preceptorat.pending") ?? "[]")).toHaveLength(1);
    expect(localStorage.getItem("preceptorat.draft.2026-01-03-latin-L2")).toContain("insula");
  });
});
