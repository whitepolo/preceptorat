import { readFileSync, writeFileSync } from "node:fs";
import { stateFromCatalog } from "../src/lib/legacy";
import type { CardCatalog } from "../src/lib/types";

const catalog = JSON.parse(readFileSync("content/cartes.json", "utf8")) as CardCatalog;
const state = stateFromCatalog(catalog.cards, "2026-11-11T15:00:00.000Z");
writeFileSync("content/etat/revisions.json", `${JSON.stringify(state, null, 2)}\n`);
console.log(`cartes: ${Object.keys(state.cards).length}`);
