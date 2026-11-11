import { useEffect, useRef, useState } from "react";
import { catalog } from "../content";
import { MarkdownView } from "../components/MarkdownView";
import { previewIntervals } from "../lib/scheduler";
import { readToken } from "../lib/prefs";
import type { GradeName } from "../lib/types";
import { useReviews } from "../state";

const GRADES: { id: GradeName; label: string }[] = [
  { id: "again", label: "À revoir" },
  { id: "hard", label: "Difficile" },
  { id: "good", label: "Correct" },
  { id: "easy", label: "Facile" },
];

export function Revisions() {
  const { queue, plan, status, ready, state, grade } = useReviews();
  const [text, setText] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const gradesRef = useRef<HTMLDivElement>(null);
  const currentId = queue[0];
  const card = catalog.cards.find((item) => item.id === currentId);
  const stored = currentId ? state.cards[currentId] : undefined;

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
            : `${plan.deferred} carte${plan.deferred > 1 ? "s" : ""} reste${plan.deferred > 1 ? "nt" : ""} pour un autre soir. Le plafond est de 8.`}
        </p>
        <p className="hint" role="status">
          {status}
        </p>
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
      <p className="hint" role="status">
        {readToken() ? status : "Sans jeton, la note reste sur cet appareil jusqu'à la synchronisation."}
      </p>
      </article>
  );
}
