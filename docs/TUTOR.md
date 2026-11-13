# Tutor guide

Préceptorat is a static site. You publish by pushing files to `main`. GitHub Actions builds the site and deploys GitHub Pages. Sébastien reads the lesson in the app. He answers on a GitHub issue. A second workflow wakes you when he writes.

Pages URL: `https://whitepolo.github.io/preceptorat/`

One-time setup, not done by the app:

1. Repository Settings, Pages, source: GitHub Actions.
2. Repository secrets `PRECEPTEUR_WEBHOOK_URL` and `PRECEPTEUR_WEBHOOK_AUTH`. The auth secret is sent verbatim as the `Authorization` header. If either secret is missing, the workflow skips and does not fail. The workflow never prints the secrets.

He does not use a token. The app only reads the public repository. To write, it opens a prefilled new-issue URL. He presses Submit while logged in to GitHub. Do not put a webhook URL or a secret in the repository.

## Publish a lesson

1. Add `content/lecons/AAAA-MM-JJ-matiere-LN.json`. The id, the date, and the filename match. French. No em dash (U+2014) and no en dash (U+2013) anywhere in the text.
2. Follow `docs/FORMAT.md` and `schema/lecon.schema.json`. A Classiques lesson needs `module` and the section `regard` (code S).
3. Check locally: `npm run validate` and `npm test`.
4. Push to `main`. The site rebuilds. The lesson appears for that calendar date (UTC+4) as soon as the deploy is live, at any time of day, and not before that date. Until then it stays out of Aujourd'hui and the library. The learner is told the lesson arrives from 7:00.

Section order: rappel, correction, pré-questions, notion, exemples, regard (when used), exercices, réflexion, ticket. Solutions live on each question and stay hidden in the app until he has typed or skipped.

End every new lesson with `pour_aller_plus_loin`: at least two notices, `{ "type": "primaire" or "secondaire", "reference", "note" }`. `reference` is the full citation (author, title, translator or editor, publisher, year, pages). `note` is one line on why it is worth reading. Add `citation` only when you have the exact words, and then `citation_source` (page or locus) is required. `lien` is an optional open-access or catalogue URL. Never invent a reference or a quotation. Lessons dated before 2026-11-17 may omit the array. The app shows this list as the last reading step, after À retenir, and gathers every entry in Bibliothèque.

The home screen shows a lesson only when its date is today (UTC+4). It is visible for the whole calendar day, from the moment it is published. Older lesson files stay available from Bibliothèque and from the link when today's lesson is not published yet.

`rappel` and `correction` may be omitted. Add `rappel` only from cards that are actually due that day (ceiling 8, subjects mixed). Do not interleave a vocabulary card on its first presentation (`kind: "vocabulaire"` and zero reviews). If `content/cartes.json` is empty, leave the recall out. Do not copy forward old cards: a card id absent from `cartes.json` is dropped from `content/etat/revisions.json` on the next sync and is not restored from a phone cache.

## Add cards

Append objects to `content/cartes.json`. Required fields: `id` (`LAT-026`), `subject`, `subject_label`, `prompt`, `answer`, `created` (`AAAA-MM-JJ`), `kind` (`notion` or `vocabulaire`).

Do not hand-edit scheduling for a card that already exists in `content/etat/revisions.json`. The app creates a new FSRS card the first time it sees an id that has no state. New cards are due the day after `created`. The scheduler is ts-fsrs (FSRS-6 as shipped by the library), requested retention 0.9, fuzz off, short-term steps on, maximum interval 365 days. Grades: Again, Hard, Good, Easy, shown as À revoir, Difficile, Correct, Facile.

## Handle an issue he opened

He always opens a new issue. There is no prefilled comment. Titles:

- `Réponses <lesson_id>`, label `reponses` when GitHub kept it
- `Dialogue`, label `dialogue`
- `Révisions <date>`, label `revisions`

If the text is long, the title ends with ` (1/2)`, ` (2/2)`, and so on. Create the three labels once (`reponses`, `dialogue`, `revisions`) so they stick. An unknown label is dropped by GitHub; the issue still opens.

The body always starts with `<!-- sebastien -->`. Then a readable Markdown part. Then a fenced `json` block. For a plain issue the JSON is the machine object. If the first line under the marker says the JSON is deflate then base64, the object is `{ "encoding": "deflate-base64", "payload": "..." }`. Inflate the payload (zlib deflate, then base64) to recover the same object.

Machine object:

- `type`: `reponses`, `dialogue`, or `revisions`
- `lesson_id`: the lesson id, or null
- `date`: the study date, or null
- `part`, `parts`
- `answers`: code to text, for a lesson
- `message`: free text, for Dialogue
- `elapsed_min`: minutes on the lesson, when present
- `grades`: `{ "card_id", "grade", "reviewed_at" }` with grade `again`, `hard`, `good`, or `easy`
- `cards`: FSRS state of the cards he just graded

Reply on that issue. The marker must be the first non-space characters. Without it, the app shows the comment as his, and the webhook fires again.

```bash
gh issue comment NUMBER --body "$(printf '%s\n\n%s\n' '<!-- schopen -->' 'Ta réponse, en français, en markdown.')"
```

For `Réponses`, correct him in the next lesson's `correction` section. Codes match the lesson. `(sans réponse)` and `(passée)` are explicit. Do not ask him to catch up a missed day in bulk.

For `Révisions`, apply each grade into `content/etat/revisions.json`:

1. Read the current file on `main`.
2. For each graded card, take the `cards` object from the issue when its `updated_at` is later than the file. If the file is later, keep the file. Same `updated_at`: keep the higher `reps`, then the later `due`, then the higher `lapses`.
3. Drop any id that is not in `content/cartes.json`.
4. Commit the file on `main` and close the issue.

Phone and computer both read that file on the next launch and merge the same way. A grade he has not sent yet stays on the device and wins over the file until he opens the GitHub link.

## Read his state

- Answers and grades: the issue body, then your comment.
- Review state: `content/etat/revisions.json` on `main`. The app never writes this file. You do, from a `Révisions` issue.
- Card text stays in `content/cartes.json`. The state file only has FSRS fields: `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state` (0 new, 1 learning, 2 review, 3 relearning), `last_review`, `updated_at`.
- Progress notes you still edit by hand live in `content/progression.json` (one activity per study day, for the heatmap) and `content/programme.json` (position, modules). `content/bibliotheque.json` is the reading list.

`legacy` on a card is the old ladder from before FSRS. It is historical. Trust `content/etat/revisions.json` after you commit it.

## Wake webhook

`.github/workflows/precepteur.yml` runs on `issues` opened and `issue_comment` created. If the body does not start with `<!-- schopen -->`, it POSTs:

```json
{ "issue_number": 1, "comment_id": 2, "kind": "comment", "lesson_id": "2026-11-17-classiques-L1", "url": "https://github.com/whitepolo/preceptorat/issues/1#issuecomment-2" }
```

`kind` is `comment` or `opened`. `comment_id` is null when an issue is opened. `lesson_id` is null on the dialogue issue. The POST goes to `PRECEPTEUR_WEBHOOK_URL` with header `Authorization` taken from `PRECEPTEUR_WEBHOOK_AUTH` exactly as stored.
