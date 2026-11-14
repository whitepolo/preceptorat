import { isTutorMessage, stripTutorMarker } from "./markdown";

const CODE = /\b(R\d+|C\d+|P\d+|N\d+|X\d+|Xf|S|E\d+|Q|T\d+)\b/g;

export function splitTutorNotes(bodies: readonly string[], codes: ReadonlySet<string>): { byCode: Record<string, string[]>; general: string[] } {
  const byCode: Record<string, string[]> = {};
  const general: string[] = [];
  for (const body of bodies) {
    if (!isTutorMessage(body)) continue;
    const text = stripTutorMarker(body).trim();
    if (!text) continue;
    const found = [...text.matchAll(CODE)].map((match) => match[1]).filter((code) => codes.has(code));
    const unique = [...new Set(found)];
    if (!unique.length) {
      general.push(text);
      continue;
    }
    for (const code of unique) {
      const list = byCode[code] ?? [];
      list.push(text);
      byCode[code] = list;
    }
  }
  return { byCode, general };
}
