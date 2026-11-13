import { getRepoFile, GithubError, REVIEW_PATH } from "./github";
import { mergeWithPending, pruneUnknownCards } from "./merge";
import { SCHEDULER_ID } from "./scheduler";
import type { ReviewStateFile } from "./types";

const LOCAL_KEY = "preceptorat.revisions";
const SHA_KEY = "preceptorat.revisions.sha";

export function readLocalState(): { state: ReviewStateFile | null; sha: string | null } {
  if (typeof localStorage === "undefined") return { state: null, sha: null };
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const sha = localStorage.getItem(SHA_KEY);
    if (!raw) return { state: null, sha };
    const parsed = JSON.parse(raw) as ReviewStateFile;
    if (!parsed || parsed.schema_version !== "1.0" || !parsed.cards) return { state: null, sha };
    return { state: parsed, sha };
  } catch {
    return { state: null, sha: null };
  }
}

export function writeLocalState(state: ReviewStateFile): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

export function serializeState(state: ReviewStateFile): string {
  const cards: ReviewStateFile["cards"] = {};
  for (const id of Object.keys(state.cards).sort()) cards[id] = state.cards[id];
  const file: ReviewStateFile = {
    schema_version: "1.0",
    scheduler: SCHEDULER_ID,
    updated_at: state.updated_at,
    cards,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export interface SyncResult {
  state: ReviewStateFile;
  sha: string | null;
  synced: boolean;
  message: string;
}

export async function loadReviewState(fallback: ReviewStateFile, allowed: ReadonlySet<string>, pendingIds: ReadonlySet<string>): Promise<SyncResult> {
  const local = readLocalState();
  let remote: ReviewStateFile | null = null;
  try {
    const file = await getRepoFile(REVIEW_PATH);
    if (file) remote = JSON.parse(file.text) as ReviewStateFile;
  } catch (error) {
    const base = pruneUnknownCards(local.state ?? fallback, allowed);
    writeLocalState(base);
    const message = error instanceof GithubError ? error.message : "Lecture distante impossible. Les révisions de cet appareil restent disponibles.";
    return { state: base, sha: null, synced: false, message };
  }
  const merged = pruneUnknownCards(mergeWithPending(local.state ?? fallback, remote ?? fallback, pendingIds), allowed);
  writeLocalState(merged);
  return {
    state: merged,
    sha: null,
    synced: true,
    message: remote ? "Révisions à jour avec le dépôt." : "Pas encore d'état distant.",
  };
}
