import { useEffect, useRef, useState } from "react";
import { catalog } from "../content";
import { MarkdownView } from "../components/MarkdownView";
import { formatStamp } from "../lib/dates";
import { buildIssueLinks, openFirstIssue, prepareIssueWindow, type GradeEvent, type IssueLink } from "../lib/issueLink";
import { markSent, readSentMap } from "../lib/localProgress";
import { emptyStored, previewIntervals } from "../lib/scheduler";
import type { GradeName, ReviewStateFile } from "../lib/types";
import { useReviews } from "../state";

function SendReviews({
  pending,
  state,
  today,
  status,
  links,
  sentAt,
  onSent,
}: {
  pending: GradeEvent[];
  state: ReviewStateFile;
  today: string;
  status: string;
  links: IssueLink[];
  sentAt: string | null;
  onSent: (links: IssueLink[], when: string) => void;
}) {
  return (
    <>
      <p className="hint" role="status">
        {pending.length > 0
          ? pending.length === 1
            ? "1 révision pas encore envoyée."
            : `${pending.length} révisions pas encore envoyées.`
          : status}
      </p>
      {pending.length > 0 || links.length > 0 ? (
        <div className="actions">
          <button
            type="button"
            className="button primary"
            disabled={pending.length === 0}
            onClick={() => {
              const popup = prepareIssueWindow();
              void (async () => {
                const cards: ReviewStateFile["cards"] = {};
                for (const item of pending) {
                  const stored = state.cards[item.card_id];
                  if (stored) cards[item.card_id] = stored;
                }
                const next = await buildIssueLinks({
                  type: "revisions",
                  lesson_id: null,
                  date: today,
                  human: pending
                    .map((item) => {
                      const label = GRADES.find((gradeItem) => gradeItem.id === item.grade)?.label ?? item.grade;
                      return `- ${item.card_id} : ${label}`;
                    })
                    .join("\n"),
                  grades: pending,
                  cards,
                });
                const when = new Date().toISOString();
                markSent(`revisions:${today}`, when);
                onSent(next, when);
                openFirstIssue(next, popup);
              })();
            }}
          >
            Envoyer au précepteur
          </button>
        </div>
      ) : null}
      {sentAt ? <p className="hint">Envoyé le {formatStamp(sentAt)}.</p> : null}
      {links.map((link) => (
        <p key={link.part}>
          <a href={link.url} target="_blank" rel="noopener noreferrer">
            {link.parts > 1 ? `Ouvrir la partie ${link.part}/${link.parts}` : "Ouvrir sur GitHub"}
          </a>
        </p>
      ))}
    </>
  );
}

const GRADES: { id: GradeName; label: string }[] = [
  { id: "again", label: "À revoir" },
  { id: "hard", label: "Difficile" },
  { id: "good", label: "Correct" },
  { id: "easy", label: "Facile" },
];

export function Revisions() {
  const { queue, plan, status, ready, state, grade, today, pending, markReviewsSent } = useReviews();
  const [text, setText] = useState("");
  const [links, setLinks] = useState<IssueLink[]>([]);
  const [sentAt, setSentAt] = useState<string | null>(() => readSentMap()[`revisions:${today}`] ?? null);
  const [skipped, setSkipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const gradesRef = useRef<HTMLDivElement>(null);
  const currentId = queue[0];
  const card = catalog.cards.find((item) => item.id === currentId);
  const stored = currentId ? (state.cards[currentId] ?? emptyStored(new Date(), new Date().toISOString())) : undefined;

  useEffect(() => {
    setText("");
    setSkipped(false);
    setRevealed(false);
  }, [currentId]);

  useEffect(() => {
    if (revealed) gradesRef.current?.scrollIntoView({ block: "nearest" });
  }, [revealed]);

  if (!ready) {
    return (
      <article className="sheet">
        <h1>Révisions</h1>
        <p>Chargement.</p>
      </article>
    );
  }

  if (catalog.cards.length === 0) {
    return (
      <article className="sheet">
        <h1>Révisions</h1>
        <p className="lede">Aucune carte pour l'instant. Les cartes arriveront avec les nouvelles leçons.</p>
      </article>
    );
  }

  if (!card || !stored) {
    return (
      <article className="sheet">
        <h1>Révisions</h1>
        <p className="lede">Rien n'est dû pour la suite de cette séance.</p>
        <p>
          {plan.dueTotal === 0
            ? "Aucune carte n'arrive à échéance aujourd'hui."
            : `${plan.deferred} carte${plan.deferred > 1 ? "s" : ""} reste${plan.deferred > 1 ? "nt" : ""} pour un autre jour. Le plafond est de 8.`}
        </p>
        <SendReviews
          pending={pending}
          state={state}
          today={today}
          status={status}
          links={links}
          sentAt={sentAt}
          onSent={(next, when) => {
            setLinks(next);
            setSentAt(when);
            markReviewsSent();
          }}
        />
      </article>
    );
  }

  const open = skipped || text.trim().length > 0;
  const previews = previewIntervals(stored, new Date());
  const doneCount = plan.ids.length - queue.length;

  async function choose(name: GradeName) {
    if (!open || !card) return;
    setBusy(true);
    try {
      await grade(card.id, name);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="sheet">
      <p className="kicker">
        {card.subject_label} · {card.id}
      </p>
      <h1>Révisions</h1>
      <p className="lede">
        Carte {Math.min(doneCount + 1, plan.ids.length)} sur {plan.ids.length}. {plan.dueTotal} due{plan.dueTotal > 1 ? "s" : ""} aujourd'hui
        {plan.deferred ? `, ${plan.deferred} reportée${plan.deferred > 1 ? "s" : ""} à demain` : ""}. Les matières sont mélangées. Le vocabulaire jamais revu vient en bloc, à la fin.
      </p>
      <section className="card-face">
        <MarkdownView source={card.prompt} />
        <label className="field">
          <span>Ta réponse, de mémoire</span>
          <textarea rows={4} value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        <div className="actions">
          <button type="button" className="button quiet" onClick={() => setSkipped(true)}>
            Je ne sais pas
          </button>
          <button type="button" className="button" disabled={!open} onClick={() => setRevealed(true)}>
            Voir la réponse
          </button>
        </div>
        {!open ? <p className="hint">Écris d'abord, ou dis que tu ne sais pas. La réponse reste cachée.</p> : null}
        {revealed && open ? (
          <div className="solution">
            <p className="solution-label">Réponse attendue</p>
            <MarkdownView source={card.answer} />
            <p className="meta">Comment c'était ?</p>
            <div className="grades" ref={gradesRef}>
              {GRADES.map((item) => (
                <button key={item.id} type="button" className={`grade grade-${item.id}`} disabled={busy} onClick={() => void choose(item.id)}>
                  {item.label}
                  <small>{previews[item.id]}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      <SendReviews
        pending={pending}
        state={state}
        today={today}
        status={status}
        links={links}
        sentAt={sentAt}
        onSent={(next, when) => {
          setLinks(next);
          setSentAt(when);
          markReviewsSent();
        }}
      />
      </article>
  );
}
