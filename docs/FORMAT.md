# Formats

English workflow: `docs/TUTOR.md`. This file is the contract for the files in `content/`. Language of the lessons: French. No em dash (U+2014) and no en dash (U+2013) in any string the app can show. The validator rejects both, in content and in `src/`.

Check: `npm run validate` (schema plus these rules) and `npm test`.

## Lesson

Path: `content/lecons/AAAA-MM-JJ-matiere-LN.json`

The filename is the `id`. `id` starts with `date` and `subject`. Example: `2026-11-17-classiques-L1`.

Schema: `schema/lecon.schema.json` (JSON Schema 2020-12).

Required:

| Field | Rule |
| --- | --- |
| schema_version | `"1.0"` |
| id | `AAAA-MM-JJ-matiere-LN` |
| title | `AAAA-MM-JJ · Matière · Leçon N : sujet` (middle dot, not an em dash) |
| date | `AAAA-MM-JJ` |
| subject | `latin`, `classiques`, `philosophie`, `mathematiques`, `sciences`, `economie`, `econometrie`, `quiz`, `art`, `histoire` |
| subject_label | Visible name |
| lesson_number | Integer, from 1 |
| duration_min | `{ "min": 30, "max": 45 }`, min not above max |
| lang | `"fr"` |
| objectives | 2 to 4 strings |
| student_note | Tell him to answer in the thread, with the codes, before reading a solution |
| sections | See the order below |
| retenir | 4 to 6 sentences, no question |
| mot_du_jour | `{ "code": "M", "terme", "texte" }` |
| pour_aller_plus_loin | Required for a lesson dated 2026-11-17 or later. Optional before that (legacy). At least 2 entries when present. |

`module` (`{ "id", "title" }`) is required for `classiques` and recommended elsewhere. `prerequisites` and `sources` (`type`: `primary`, `secondary`, or `method`, plus `cite`) are recommended. `weekday` is optional.

`histoire` remains a valid subject for the closed track. Do not reopen that track except through the existing HIS cards.

### Sections

Ids, in this order. A section may be omitted. It may not move earlier than a section that belongs before it. Classiques lessons must include `regard`. `rappel` and `correction` are optional: leave them out when there is nothing to recall or nothing to correct. The tutor adds the recall the day he publishes, from the cards actually due.

| id | Title | Codes | kind |
| --- | --- | --- | --- |
| rappel | Rappel | R1 to R8 | recall. Omit the whole section when no card is due. |
| correction | Correction | C, C1, C2, or none | feedback. Omit the section when there is nothing to correct. |
| prequestions | Pré-questions | P1, P2 | prequestion |
| cours | Notion du jour | N, N1, or none | notion |
| exemples | Exemples résolus | X1, X2, Xf | worked, and complete for Xf |
| regard | Le regard des maîtres | S, exactly one | secondary |
| exercices | Exercices | E1, E2, ... | exercise |
| reflexion | Question de réflexion | Q | reflection |
| ticket | Ticket de sortie | T1, T2 | ticket |

A question always has `code`, `kind`, `prompt`, `solution`. Prompts and solutions are Markdown. The app escapes raw HTML.

`card_id` (`LAT-025`) is allowed only on rappel questions, when the prompt comes from a card.

`regard` also has `secondary`: `{ "work", "idea", "question", "solution" }`. `idea` is a short paraphrase or a brief quotation with the reference, not a long copyrighted extract. The question `S` repeats `question` and `solution`.

`cours` may include `excerpt` when there is a primary passage:

```json
{
  "work": "Épopée de Gilgamesh, version standard akkadienne",
  "locus": "tablette I, lignes 1-10 et 18-28",
  "edition": "A. R. George, The Babylonian Gilgamesh Epic, Oxford University Press, 2003.",
  "translator": "traduction de travail, pour cette leçon, d'après l'édition citée",
  "lang": "fr",
  "text": "Texte de l'extrait.",
  "close_reading": "Lecture suivie, en Markdown."
}
```

Cite a scholarly or primary source. If a French translation is still in copyright, write a short working translation from the critical edition and give the exact place. Do not invent a text. Do not paste a protected translation.

`cours` may include `figures`: `{ "type": "table", "caption", "columns", "rows" }`. Each row has as many cells as there are columns.

The prompts of X1 and X2 already contain the worked model. Xf, and every other question he must do, keeps the solution only in `solution`.

The app shows the lesson one step at a time. Each question has an answer field. The solution stays hidden until he types or skips. À retenir and the word of the day have no solution button. The last reading step after À retenir is Pour aller plus loin.

### Pour aller plus loin

```json
"pour_aller_plus_loin": [
  {
    "type": "primaire",
    "reference": "Author, Title, translator or editor, publisher, year, pages.",
    "note": "One line: why read it, and what it adds.",
    "citation": "Optional short quotation, copied exactly.",
    "citation_source": "Page or locus. Required when citation is present.",
    "lien": "https://example.edu/record"
  }
]
```

`type` is `primaire` or `secondaire`. `reference` is a full academic citation. `note` is a single line. `lien` is optional and must be an http(s) URL to an open-access text or a library record. Do not invent a reference, a page, or a quotation. If the exact wording and its locus are not in front of you, omit `citation`. A lesson dated before 2026-11-17 may omit the array. From that date on, the validator requires at least two entries.

## Cards

`content/cartes.json`:

```json
{
  "schema_version": "1.0",
  "cards": [
    {
      "id": "LAT-026",
      "subject": "latin",
      "subject_label": "Latin",
      "prompt": "Question courte.",
      "answer": "Réponse courte.",
      "created": "2026-11-18",
      "kind": "vocabulaire"
    }
  ]
}
```

`kind` is `notion` or `vocabulaire`. Optional `legacy` records the old ladder (level, last_review, next_review, reps, lapses, history). It is not the live schedule.

## Review state

`content/etat/revisions.json` is written by the app. You can read it. Avoid editing a card by hand while he is studying: the merge keeps the later `updated_at`.

```json
{
  "schema_version": "1.0",
  "scheduler": "fsrs-6",
  "updated_at": "2026-11-11T15:00:00.000Z",
  "cards": {
    "LAT-001": {
      "due": "2026-11-12T15:00:00.000Z",
      "stability": 6,
      "difficulty": 4.7,
      "elapsed_days": 0,
      "scheduled_days": 6,
      "learning_steps": 0,
      "reps": 2,
      "lapses": 0,
      "state": 2,
      "last_review": "2026-11-06T15:00:00.000Z",
      "updated_at": "2026-11-06T15:00:00.000Z"
    }
  }
}
```

Times are UTC. A stored due instant of 15:00Z is 19:00 at UTC+4; that is only the nominal instant written on a card, not the hour when the lesson appears. A lesson file dated today is shown for the whole calendar day, as soon as it is published. `state`: 0 new, 1 learning, 2 review, 3 relearning. `cards` may be an empty object. Do not keep scheduling data for a card id that is no longer in `content/cartes.json`: the app drops those ids and will not write them back.

## Programme, library, progress

`content/programme.json`: `schema_version` 1.0, learner, rotation, subjects, modules, lessons (`status`: `faite`, `prévue`, `à venir`), `points_fragiles`, `mastery_threshold` (0.8), `closed`.

`content/bibliotheque.json`: shelves. Each work has `role` (`primaire`, `secondaire`, `commentaire`), `title`, `authors`, `year`, `cite`, optional `note` and `reserve`.

`content/progression.json`: `activities` (`date`, `kind` `leçon` or `réponses`, `summary`) feed the heatmap. `entries` are the log lines.

## Issues

Not files, but part of the format.

- Lesson thread: title = lesson id, label `leçon`. His answers are one comment, each line `**CODE.** text`.
- Dialogue: title `Dialogue`, label `dialogue`.
- Your reply starts with `<!-- schopen -->`.
- His messages start with `<!-- sebastien -->`.
