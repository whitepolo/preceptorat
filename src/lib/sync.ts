import { getRepoFile, GithubError, putRepoFile, REVIEW_PATH } from "./github";
import { mergeStates, pruneUnknownCards, statesEqual } from "./merge";
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

export function writeLocalState(state: ReviewStateFile, sha: string | null): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  if (sha) localStorage.setItem(SHA_KEY, sha);
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

export async function loadReviewState(fallback: ReviewStateFile, allowed: ReadonlySet<string>, token?: string): Promise<SyncResult> {
  const local = readLocalState();
  let remote: ReviewStateFile | null = null;
  let sha = local.sha;
  try {
    const file = await getRepoFile(REVIEW_PATH, token);
    if (file) {
      remote = JSON.parse(file.text) as ReviewStateFile;
      sha = file.sha;
    }
  } catch (error) {
    const base = pruneUnknownCards(local.state ?? fallback, allowed);
    writeLocalState(base, local.sha);
    const message = error instanceof GithubError ? error.message : "Lecture distante impossible. Les révisions de cet appareil restent disponibles.";
    return { state: base, sha: local.sha, synced: false, message };
  }
  const merged = pruneUnknownCards(mergeStates(mergeStates(fallback, remote ?? fallback), local.state ?? fallback), allowed);
  writeLocalState(merged, sha);
  if (token && remote && !statesEqual(merged, pruneUnknownCards(remote, allowed))) {
    return pushReviewState(merged, token, sha, allowed);
  }
  return {
    state: merged,
    sha,
    synced: true,
    message: remote ? "Révisions à jour." : "Pas encore d'état distant.",
  };
}

export async function pushReviewState(state: ReviewStateFile, token: string, sha: string | null, allowed: ReadonlySet<string>): Promise<SyncResult> {
  let currentSha = sha;
  let current = pruneUnknownCards(state, allowed);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const nextSha = await putRepoFile(
        REVIEW_PATH,
        serializeState(current),
        currentSha,
        "chore: synchroniser les révisions",
        token,
      );
      writeLocalState(current, nextSha);
      return { state: current, sha: nextSha, synced: true, message: "Révisions synchronisées." };
    } catch (error) {
      if (!(error instanceof GithubError) || error.status !== 409) {
        writeLocalState(current, currentSha);
        const message = error instanceof GithubError ? error.message : "Synchronisation impossible pour le moment.";
        return { state: current, sha: currentSha, synced: false, message };
      }
      const remoteFile = await getRepoFile(REVIEW_PATH, token);
      if (!remoteFile) {
        currentSha = null;
        continue;
      }
      const remote = JSON.parse(remoteFile.text) as ReviewStateFile;
      current = pruneUnknownCards(mergeStates(current, remote), allowed);
      currentSha = remoteFile.sha;
      writeLocalState(current, currentSha);
    }
  }
  return { state: current, sha: currentSha, synced: false, message: "Conflit de synchronisation non résolu. Réessaie dans un instant." };
}
