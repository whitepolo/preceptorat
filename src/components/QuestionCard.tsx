import type { DraftAnswer, LessonQuestion } from "../lib/types";
import { canReveal } from "../lib/answers";
import { MarkdownView } from "./MarkdownView";

export function QuestionCard({
  question,
  draft,
  onChange,
}: {
  question: LessonQuestion;
  draft: DraftAnswer;
  onChange: (next: DraftAnswer) => void;
}) {
  const open = canReveal(draft);
  return (
    <article className="question" id={`q-${question.code}`}>
      <header className="question-head">
        <span className="code">{question.code}</span>
        {question.kind === "worked" ? <span className="pill">Exemple résolu</span> : null}
        {question.kind === "complete" ? <span className="pill">À toi de finir</span> : null}
      </header>
      <MarkdownView source={question.prompt} />
      {question.kind === "worked" ? (
        <p className="hint">L'exemple est déjà conduit. Tu peux le reformuler en une phrase, ou passer.</p>
      ) : null}
      <label className="field">
        <span>Ta réponse</span>
        <textarea
          value={draft.text}
          rows={4}
          onChange={(event) => onChange({ ...draft, text: event.target.value })}
        />
      </label>
      <div className="actions">
        <button type="button" className="button quiet" onClick={() => onChange({ ...draft, skipped: true })}>
          Passer
        </button>
        <button
          type="button"
          className="button"
          disabled={!open}
          onClick={() => onChange({ ...draft, revealed: !draft.revealed })}
        >
          {draft.revealed && open ? "Masquer la solution" : "Voir la solution"}
        </button>
      </div>
      {!open ? <p className="hint">Écris une réponse, ou passe, pour découvrir la solution.</p> : null}
      {draft.revealed && open ? (
        <div className="solution" role="region" aria-label={`Solution ${question.code}`}>
          <p className="solution-label">Solution</p>
          <MarkdownView source={question.solution} />
        </div>
      ) : null}
    </article>
  );
}
