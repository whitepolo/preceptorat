import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { State } from "ts-fsrs";
import { catalog, lessons, seedState } from "../content";
import { canReveal, formatAnswerComment } from "./answers";
import { stateFromCatalog } from "./legacy";
import { mauritiusDate } from "./dates";
import { lessonForToday, selectTonightLesson } from "./lessons";
import { isTutorMessage, renderMarkdown, stripTutorMarker } from "./markdown";
import { mergeStates, pickCard, pruneUnknownCards } from "./merge";
import { applyGrade } from "./scheduler";
import { selectSession } from "./session";
import type { ReviewStateFile, StoredCard } from "./types";

describe("leçon du jour", () => {
  it("n'ouvre que la leçon datée du jour, et garde la plus récente pour le lien", () => {
    expect(lessonForToday(lessons, "2026-11-11")).toBeNull();
    expect(lessonForToday(lessons, "2026-11-16")).toBeNull();
    expect(lessonForToday(lessons, "2026-11-17")?.id).toBe("2026-11-17-classiques-L1");
    expect(selectTonightLesson(lessons, "2026-11-11")).toBeNull();
    expect(selectTonightLesson(lessons, "2026-11-18")?.id).toBe("2026-11-17-classiques-L1");
    expect(lessons.map((lesson) => lesson.id)).toEqual(["2026-11-17-classiques-L1"]);
  });

  it("affiche la leçon du jour dès sa date, matin ou après-midi", () => {
    const early = new Date("2026-11-17T02:30:00.000Z");
    const morning = new Date("2026-11-17T03:30:00.000Z");
    const afternoon = new Date("2026-11-17T12:00:00.000Z");
    for (const instant of [early, morning, afternoon]) {
      expect(mauritiusDate(instant)).toBe("2026-11-17");
      expect(lessonForToday(lessons, mauritiusDate(instant))?.id).toBe("2026-11-17-classiques-L1");
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

  it("part d'un catalogue vide", () => {
    expect(catalog.cards).toEqual([]);
    expect(seedState.cards).toEqual({});
    expect(stateFromCatalog([], "2026-11-11T00:00:00.000Z").cards).toEqual({});
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
    const lesson = lessons.find((item) => item.id === "2026-11-17-classiques-L1")!;
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
  it("exige une bibliographie sans citation inventée", () => {
    const lesson = lessons.find((item) => item.id === "2026-11-17-classiques-L1");
    expect(lesson?.pour_aller_plus_loin && lesson.pour_aller_plus_loin.length >= 2).toBe(true);
    for (const entry of lesson?.pour_aller_plus_loin ?? []) {
      expect(entry.citation ?? "").toBe("");
      expect(entry.reference.length).toBeGreaterThan(10);
    }
  });

  it("accepte le dépôt", () => {
    const out = execFileSync("node", ["scripts/validate-content.mjs"], { encoding: "utf8" });
    expect(out).toContain("Contenu valide");
  });

  it("refuse un tiret cadratin", () => {
    const script = `
      import { validateLesson } from "./scripts/validate-content.mjs";
      import lesson from "./content/lecons/2026-11-17-classiques-L1.json" with { type: "json" };
      const copy = structuredClone(lesson);
      copy.objectives[0] = "objectif " + String.fromCharCode(0x2014);
      const errors = validateLesson(copy, "2026-11-17-classiques-L1.json");
      if (!errors.some((error) => error.includes("tiret"))) process.exit(1);
    `;
    execFileSync("node", ["--input-type=module", "-e", script], { encoding: "utf8" });
  });
});
