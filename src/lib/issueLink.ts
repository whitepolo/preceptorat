import type { GradeName, StoredCard } from "./types";

export const ISSUE_URL_LIMIT = 7000;
const NEW_ISSUE = "https://github.com/whitepolo/preceptorat/issues/new";

export interface GradeEvent {
  card_id: string;
  grade: GradeName;
  reviewed_at: string;
}

export interface IssueMachine {
  type: "reponses" | "dialogue" | "revisions";
  lesson_id: string | null;
  date: string | null;
  part: number;
  parts: number;
  answers?: Record<string, string>;
  message?: string;
  elapsed_min?: number | null;
  grades?: GradeEvent[];
  cards?: Record<string, StoredCard>;
  encoding?: "deflate-base64";
  payload?: string;
}

export interface IssueDraft {
  type: IssueMachine["type"];
  lesson_id?: string | null;
  date?: string | null;
  human: string;
  answers?: Record<string, string>;
  message?: string;
  elapsed_min?: number | null;
  grades?: GradeEvent[];
  cards?: Record<string, StoredCard>;
}

export interface IssueLink {
  title: string;
  url: string;
  part: number;
  parts: number;
}

function titleFor(draft: IssueDraft, part: number, parts: number): string {
  const base =
    draft.type === "reponses"
      ? `Réponses ${draft.lesson_id ?? ""}`.trim()
      : draft.type === "dialogue"
        ? "Dialogue"
        : `Révisions ${draft.date ?? ""}`.trim();
  return parts > 1 ? `${base} (${part}/${parts})` : base;
}

function labelFor(type: IssueDraft["type"]): string {
  if (type === "reponses") return "reponses";
  if (type === "dialogue") return "dialogue";
  return "revisions";
}

export async function deflateBase64(text: string): Promise<string> {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream("deflate"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function inflateBase64(payload: string): Promise<string> {
  const binary = atob(payload);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

function machineOf(draft: IssueDraft, part: number, parts: number): IssueMachine {
  return {
    type: draft.type,
    lesson_id: draft.lesson_id ?? null,
    date: draft.date ?? null,
    part,
    parts,
    ...(draft.answers ? { answers: draft.answers } : {}),
    ...(draft.message ? { message: draft.message } : {}),
    ...(draft.elapsed_min !== undefined ? { elapsed_min: draft.elapsed_min } : {}),
    ...(draft.grades ? { grades: draft.grades } : {}),
    ...(draft.cards ? { cards: draft.cards } : {}),
  };
}

async function bodyFor(draft: IssueDraft, part: number, parts: number, compress: boolean): Promise<string> {
  const machine = machineOf(draft, part, parts);
  const json = compress
    ? JSON.stringify({ encoding: "deflate-base64", payload: await deflateBase64(JSON.stringify(machine)) })
    : JSON.stringify(machine, null, 2);
  const note = compress ? "Machine : le JSON qui suit est compressé en deflate puis encodé en base64.\n\n" : "";
  const human = draft.human.trim();
  return `<!-- sebastien -->\n\n${human}\n\n${note}\`\`\`json\n${json}\n\`\`\`\n`;
}

function issueUrl(title: string, body: string, label: string): string {
  const params = new URLSearchParams({ title, body, labels: label });
  return `${NEW_ISSUE}?${params.toString()}`;
}

function sliceDraft(draft: IssueDraft, index: number, parts: number): IssueDraft {
  if (draft.answers) {
    const keys = Object.keys(draft.answers);
    const size = Math.ceil(keys.length / parts);
    const chosen = keys.slice(index * size, (index + 1) * size);
    const answers: Record<string, string> = {};
    const lines = chosen.map((key) => {
      answers[key] = draft.answers?.[key] ?? "";
      return `**${key}.** ${answers[key]}`;
    });
    return { ...draft, answers, human: [`Partie ${index + 1}/${parts}.`, "", ...lines].join("\n") };
  }
  if (draft.grades) {
    const size = Math.ceil(draft.grades.length / parts);
    const grades = draft.grades.slice(index * size, (index + 1) * size);
    const cards: Record<string, StoredCard> = {};
    for (const grade of grades) {
      const card = draft.cards?.[grade.card_id];
      if (card) cards[grade.card_id] = card;
    }
    const lines = grades.map((grade) => `- ${grade.card_id} : ${grade.grade} (${grade.reviewed_at})`);
    return {
      ...draft,
      grades,
      cards,
      human: [`Partie ${index + 1}/${parts}.`, "", ...lines].join("\n"),
    };
  }
  const text = draft.message ?? draft.human;
  const size = Math.ceil(text.length / parts);
  const message = text.slice(index * size, (index + 1) * size);
  return { ...draft, message, human: `Partie ${index + 1}/${parts}.\n\n${message}` };
}

async function linksFor(draft: IssueDraft, parts: number, compress: boolean): Promise<IssueLink[]> {
  const links: IssueLink[] = [];
  for (let index = 0; index < parts; index += 1) {
    const slice = parts === 1 ? draft : sliceDraft(draft, index, parts);
    const body = await bodyFor(slice, index + 1, parts, compress);
    const title = titleFor(draft, index + 1, parts);
    links.push({ title, url: issueUrl(title, body, labelFor(draft.type)), part: index + 1, parts });
  }
  return links;
}

export async function buildIssueLinks(draft: IssueDraft): Promise<IssueLink[]> {
  const plain = await linksFor(draft, 1, false);
  if (plain.every((link) => link.url.length <= ISSUE_URL_LIMIT)) return plain;
  const packed = await linksFor(draft, 1, true);
  if (packed.every((link) => link.url.length <= ISSUE_URL_LIMIT)) return packed;
  const units = draft.answers ? Object.keys(draft.answers).length : draft.grades ? draft.grades.length : Math.max(1, (draft.message ?? draft.human).length);
  for (let parts = 2; parts <= Math.max(2, units); parts += 1) {
    const split = await linksFor(draft, parts, true);
    if (split.every((link) => link.url.length <= ISSUE_URL_LIMIT)) return split;
  }
  return linksFor(draft, Math.max(2, units), true);
}

export function prepareIssueWindow(): Window | null {
  if (typeof window === "undefined") return null;
  return window.open("", "_blank");
}

export function openFirstIssue(links: IssueLink[], popup?: Window | null): void {
  const first = links[0];
  if (!first) return;
  if (popup && !popup.closed) {
    popup.location.href = first.url;
    popup.opener = null;
    return;
  }
  window.open(first.url, "_blank", "noopener");
}
