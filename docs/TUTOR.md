# Tutor guide

Préceptorat is a static site. You publish by pushing files to `main`. GitHub Actions builds the site and deploys GitHub Pages. Sébastien reads the lesson in the app. He answers on a GitHub issue. A second workflow wakes you when he writes.

Pages URL: `https://whitepolo.github.io/preceptorat/`

One-time setup, not done by the app:

1. Repository Settings, Pages, source: GitHub Actions.
2. Repository secrets `PRECEPTEUR_WEBHOOK_URL` and `PRECEPTEUR_WEBHOOK_AUTH`. The auth secret is sent verbatim as the `Authorization` header. If either secret is missing, the workflow skips and does not fail. The workflow never prints the secrets.

His fine-grained token (stored only in his browser) needs Issues read/write and Contents read/write on this repository only. You do not commit that token.

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

## Reply

Same GitHub account as the messages he posts. The app tells your comments from his by a hidden marker on the first line, not by the author login.

```bash
gh issue comment NUMBER --body "$(printf '%s\n\n%s\n' '<!-- schopen -->' 'Ta réponse, en français, en markdown.')"
```

The marker must be the first non-space characters. Without it, the app shows the comment as his, and the webhook fires again.

One issue per lesson: label `leçon`, title exactly the lesson id (`2026-11-17-classiques-L1`). One general issue: label `dialogue`, title `Dialogue`. The app creates either issue on his first message if it is missing. Keep them open.

His answer comment looks like this:

```markdown
<!-- sebastien -->

Réponses de Sébastien, leçon 2026-11-17-classiques-L1.
Temps passé : 32 min.

**R1.** ...
```

Codes match the lesson: R1 to R8, C, P1, X1, Xf, S, E1, Q, T1, T2. `(sans réponse)` and `(passée)` are explicit. Correct him in the next lesson's `correction` section. Do not ask him to catch up a missed day in bulk.

## Read his state

- Answers: the lesson issue comments.
- Review state: `content/etat/revisions.json` on `main`. The app writes it through the Contents API when a token is present. Phone and computer merge by `updated_at` per card (later write wins; equal time keeps the higher `reps`). `localStorage` is the offline cache.
- Card text stays in `content/cartes.json`. The state file only has FSRS fields: `due`, `stability`, `difficulty`, `scheduled_days`, `reps`, `lapses`, `state` (0 new, 1 learning, 2 review, 3 relearning), `last_review`, `updated_at`.
- Progress notes you still edit by hand live in `content/progression.json` (one activity per study day, for the heatmap) and `content/programme.json` (position, modules). `content/bibliotheque.json` is the reading list.

`legacy` on a card is the old ladder from before FSRS. It is historical. After the first app sync, trust `content/etat/revisions.json`.

## Wake webhook

`.github/workflows/precepteur.yml` runs on `issues` opened and `issue_comment` created. If the body does not start with `<!-- schopen -->`, it POSTs:

```json
{ "issue_number": 1, "comment_id": 2, "kind": "comment", "lesson_id": "2026-11-17-classiques-L1", "url": "https://github.com/whitepolo/preceptorat/issues/1#issuecomment-2" }
```

`kind` is `comment` or `opened`. `comment_id` is null when an issue is opened. `lesson_id` is null on the dialogue issue. The POST goes to `PRECEPTEUR_WEBHOOK_URL` with header `Authorization` taken from `PRECEPTEUR_WEBHOOK_AUTH` exactly as stored.
