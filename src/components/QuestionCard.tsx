import type { DraftAnswer, GradeName, LessonQuestion } from "../lib/types";
import { canReveal } from "../lib/answers";
import { MarkdownView } from "./MarkdownView";
import { checkAnswer, explanationOf, inferResponse, judgmentGrade, scaffoldOf, stableShuffle } from "../lib/response";

const CONFIDENCE = [
  { id: "devine", label: "Je devine" },
  { id: "peu", label: "Peu sûr" },
  { id: "assez", label: "Assez sûr" },
  { id: "sur", label: "Sûr" },
] as const;

const JUDGMENTS = [
  { id: "juste", label: "Juste" },
  { id: "partiel", label: "Partiel" },
  { id: "faux", label: "Faux" },
] as const;

function emptyDraft(): DraftAnswer {
  return { text: "", skipped: false, revealed: false };
}

export function QuestionCard({
  question,
  draft,
  notes,
  onChange,
  onGrade,
}: {
  question: LessonQuestion;
  draft?: DraftAnswer;
  notes?: string[];
  onChange: (next: DraftAnswer) => void;
  onGrade?: (grade: GradeName) => void;
}) {
  const current = draft ?? emptyDraft();
  const spec = inferResponse(question);
  const scaffold = scaffoldOf(question);
  const worked = scaffold === "resolu";
  const open = worked || current.revealed || Boolean(current.auto);
  const hints = spec.hints ?? [];
  const shownHints = hints.slice(0, current.hints ?? 0);
  const rights = spec.pairs ? stableShuffle(spec.pairs.map((pair) => pair.right), `${question.code}-droite`) : [];
  const orderPool = spec.items ? stableShuffle(spec.items, `${question.code}-ordre`) : [];

  function commit(next: DraftAnswer, gradeNow = false) {
    const auto = checkAnswer(question, next);
    let stored: DraftAnswer = auto ? { ...next, auto, revealed: true } : next;
    const mark = stored.judgment ?? stored.auto;
    const shouldGrade = Boolean(gradeNow && question.card_id && !current.graded && mark);
    if (shouldGrade) stored = { ...stored, graded: true };
    onChange(stored);
    if (shouldGrade && mark) onGrade?.(judgmentGrade(mark));
  }

  function gradeJudgment(judgment: DraftAnswer["judgment"]) {
    commit({ ...current, judgment, revealed: true }, true);
  }

  return (
    <article className={`question scaffold-${scaffold}`} id={`q-${question.code}`}>
      <header className="question-head">
        <span className="pill">{scaffold === "resolu" ? "Exemple" : scaffold === "guide" ? "Guidé" : spec.type === "prediction" ? "Avant de lire" : "À répondre"}</span>
        {spec.type === "long" && question.kind === "reflection" ? <span className="pill">Pourquoi</span> : null}
      </header>
      <div className="prose question-prompt">
        <MarkdownView source={question.prompt} />
      </div>
      {spec.consigne ? <p className="hint">{spec.consigne}</p> : null}

      {shownHints.map((hint, index) => (
        <p key={hint} className="hint-card">
          Indice {index + 1}. {hint}
        </p>
      ))}

      {worked ? (
        <div className="solution" role="region" aria-label="Exemple résolu">
          <p className="solution-label">Démarche</p>
          <MarkdownView source={question.solution} />
        </div>
      ) : null}

      {spec.type === "choix" ? (
        <div className="choice-stack" role="radiogroup" aria-label="Choix">
          {(spec.choices ?? []).map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={current.choice === choice}
              className={current.choice === choice ? "choice-btn on" : "choice-btn"}
              onClick={() => commit({ ...current, choice, text: choice, skipped: false }, true)}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : null}

      {spec.type === "vrai_faux" ? (
        <div className="choice-stack binary" role="radiogroup" aria-label="Oui ou non">
          {(["oui", "non"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={current.choice === choice}
              className={current.choice === choice ? "choice-btn on" : "choice-btn"}
              onClick={() => commit({ ...current, choice, text: choice, skipped: false }, true)}
            >
              {choice === "oui" ? "Oui" : "Non"}
            </button>
          ))}
        </div>
      ) : null}

      {spec.type === "nombre" ? (
        <label className="field">
          <span>Ta réponse, en nombre</span>
          <input
            inputMode="decimal"
            value={current.text}
            onChange={(event) => onChange({ ...current, text: event.target.value, auto: undefined, revealed: false })}
            onBlur={(event) => {
              const text = event.currentTarget.value;
              if (text.trim()) commit({ ...current, text, skipped: false }, true);
            }}
          />
        </label>
      ) : null}

      {spec.type === "court" || spec.type === "prediction" || worked ? (
        <label className="field">
          <span>{worked ? "Reformule en une phrase, si tu veux" : spec.type === "prediction" ? "Ton estimation, avant la lecture" : "Ta réponse"}</span>
          <textarea rows={spec.type === "prediction" || worked ? 3 : 2} value={current.text} onChange={(event) => onChange({ ...current, text: event.target.value, skipped: false })} />
        </label>
      ) : null}

      {spec.type === "long" && !worked ? (
        <label className="field">
          <span>Ta réponse</span>
          <textarea rows={6} value={current.text} onChange={(event) => onChange({ ...current, text: event.target.value, skipped: false })} />
        </label>
      ) : null}

      {spec.type === "ordre" && spec.items ? (
        <ol className="order-list">
          {(current.order?.length === spec.items.length ? current.order : orderPool).map((item, index, list) => (
            <li key={item}>
              <span>{item}</span>
              <span className="order-actions">
                <button
                  type="button"
                  className="button quiet"
                  disabled={index === 0}
                  aria-label={`Monter ${item}`}
                  onClick={() => {
                    const next = [...list];
                    const previous = next[index - 1];
                    next[index - 1] = next[index];
                    next[index] = previous;
                    onChange({ ...current, order: next, text: next.join(" puis "), skipped: false, auto: undefined, revealed: false });
                  }}
                >
                  Monter
                </button>
                <button
                  type="button"
                  className="button quiet"
                  disabled={index === list.length - 1}
                  aria-label={`Descendre ${item}`}
                  onClick={() => {
                    const next = [...list];
                    const following = next[index + 1];
                    next[index + 1] = next[index];
                    next[index] = following;
                    onChange({ ...current, order: next, text: next.join(" puis "), skipped: false, auto: undefined, revealed: false });
                  }}
                >
                  Descendre
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {spec.type === "appariement" && spec.pairs ? (
        <div className="pairs">
          {spec.pairs.map((pair) => (
            <label key={pair.left} className="field pair">
              <span>{pair.left}</span>
              <select
                value={current.pairs?.[pair.left] ?? ""}
                onChange={(event) => {
                  const pairs = { ...(current.pairs ?? {}), [pair.left]: event.target.value };
                  const next = { ...current, pairs, text: Object.values(pairs).join(" "), skipped: false, auto: undefined, revealed: false };
                  onChange(next);
                }}
              >
                <option value="">Choisir</option>
                {rights.map((right) => (
                  <option key={right} value={right}>
                    {right}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {spec.confidence || spec.type === "prediction" ? (
        <div className="confidence" role="radiogroup" aria-label="Degré de confiance">
          {CONFIDENCE.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={current.confidence === item.id}
              className={current.confidence === item.id ? "choice-btn on" : "choice-btn"}
              onClick={() => onChange({ ...current, confidence: item.id })}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="actions">
        {!worked && hints.length > (current.hints ?? 0) ? (
          <button type="button" className="button quiet" onClick={() => onChange({ ...current, hints: (current.hints ?? 0) + 1 })}>
            Un indice
          </button>
        ) : null}
        {(spec.type === "ordre" || spec.type === "appariement") && !current.auto ? (
          <button
            type="button"
            className="button"
            onClick={() => {
              const items = spec.items ?? [];
              const order = current.order && current.order.length === items.length ? current.order : orderPool;
              commit(spec.type === "ordre" ? { ...current, order, text: order.join(" puis ") } : current, true);
            }}
          >
            Vérifier
          </button>
        ) : null}
        {!worked && spec.type !== "choix" && spec.type !== "vrai_faux" ? (
          <button type="button" className="button quiet" onClick={() => onChange({ ...current, skipped: true })}>
            Passer
          </button>
        ) : null}
        {!worked && !current.auto ? (
          <button
            type="button"
            className="button"
            disabled={!canReveal(current)}
            onClick={() => onChange({ ...current, revealed: !current.revealed })}
          >
            {current.revealed ? "Masquer la correction" : "Voir la correction"}
          </button>
        ) : null}
      </div>

      {!worked && !canReveal(current) && !current.auto ? <p className="hint">La correction s'ouvre après ta réponse.</p> : null}

      {current.auto ? (
        <p className={current.auto === "juste" ? "verdict ok" : "verdict ko"} role="status">
          {current.auto === "juste" ? "C'est juste." : "Ce n'est pas ça."}
        </p>
      ) : null}

      {open && !worked ? (
        <div className="solution" role="region" aria-label="Correction">
          <p className="solution-label">Correction</p>
          <MarkdownView source={explanationOf(question)} />
          {!current.auto ? (
            <div className="confidence" role="radiogroup" aria-label="Ton évaluation">
              {JUDGMENTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={current.judgment === item.id}
                  className={current.judgment === item.id ? "choice-btn on" : "choice-btn"}
                  onClick={() => gradeJudgment(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {notes?.map((note) => (
        <aside key={note.slice(0, 48)} className="tutor-note">
          <p className="solution-label">Schopen</p>
          <MarkdownView source={note} />
        </aside>
      ))}
    </article>
  );
}
