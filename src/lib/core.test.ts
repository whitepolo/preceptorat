import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { State } from "ts-fsrs";
import { catalog, lessons, seedState } from "../content";
import { canReveal, formatAnswerComment } from "./answers";
import { legacyToStored, stateFromCatalog } from "./legacy";
import { selectTonightLesson } from "./lessons";
import { isTutorMessage, renderMarkdown, stripTutorMarker } from "./markdown";
import { mergeStates, pickCard } from "./merge";
import { applyGrade } from "./scheduler";
import { selectSession } from "./session";
import type { ReviewStateFile, StoredCard } from "./types";

describe("leçon du soir", () => {
  it("choisit la dernière leçon dont la date n'est pas après aujourd'hui, à Maurice", () => {
    expect(selectTonightLesson(lessons, "2026-11-08")?.id).toBeUndefined();
    expect(selectTonightLesson(lessons, "2026-11-09")?.id).toBe("2026-11-09-latin-L3");
    expect(selectTonightLesson(lessons, "2026-11-11")?.id).toBe("2026-11-10-histoire-L2");
    expect(selectTonightLesson(lessons, "2026-11-17")?.id).toBe("2026-11-17-classiques-L1");
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

  it("reproduit l'état semé à partir des cartes", () => {
    const rebuilt = stateFromCatalog(catalog.cards, "2026-11-11T15:00:00.000Z");
    expect(rebuilt.cards["LAT-014"].due).toBe(seedState.cards["LAT-014"].due);
    expect(rebuilt.cards["LAT-020"].state).toBe(State.New);
    expect(legacyToStored(catalog.cards.find((item) => item.id === "LAT-019")!).state).toBe(State.Relearning);
  });
});

describe("séance du soir", () => {
  it("mélange les matières et groupe le vocabulaire jamais revu", () => {
    const cards = catalog.cards.map((card) => ({
      id: card.id,
      subject: card.subject,
      kind: card.kind,
      due: seedState.cards[card.id].due,
      created: card.created,
      reps: seedState.cards[card.id].reps,
    }));
    const plan = selectSession(cards, "2026-11-11");
    expect(plan.dueTotal).toBe(8);
    expect(plan.deferred).toBe(0);
    expect(plan.ids).toEqual(["HIS-005", "LAT-014", "LAT-015", "LAT-020", "LAT-021", "LAT-022", "LAT-023", "LAT-024"]);
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
    const lesson = lessons.find((item) => item.id === "2026-11-10-histoire-L2")!;
    const body = formatAnswerComment(lesson, { R1: { text: "insula", skipped: false, revealed: false } }, 32);
    expect(body.startsWith("<!-- sebastien -->")).toBe(true);
    expect(isTutorMessage(body)).toBe(false);
    expect(body).toContain("**R1.** insula");
    expect(body).toContain("**R2.** (sans réponse)");
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
  it("accepte le dépôt", () => {
    const out = execFileSync("node", ["scripts/validate-content.mjs"], { encoding: "utf8" });
    expect(out).toContain("Contenu valide");
  });

  it("refuse un tiret cadratin", () => {
    const script = `
      import { validateLesson } from "./scripts/validate-content.mjs";
      import lesson from "./content/lecons/2026-11-09-latin-L3.json" with { type: "json" };
      const copy = structuredClone(lesson);
      copy.objectives[0] = "objectif " + String.fromCharCode(0x2014);
      const errors = validateLesson(copy, "2026-11-09-latin-L3.json");
      if (!errors.some((error) => error.includes("tiret"))) process.exit(1);
    `;
    execFileSync("node", ["--input-type=module", "-e", script], { encoding: "utf8" });
  });
});
