import { useEffect, useMemo, useState } from "react";
import { lessons } from "../content";
import { QuestionCard } from "../components/QuestionCard";
import { MarkdownView, Poem } from "../components/MarkdownView";
import { answerStats, canReveal, formatAnswerComment } from "../lib/answers";
import { formatClock, formatDuration, formatLongDate } from "../lib/dates";
import { GithubError, ensureLessonIssue, postComment } from "../lib/github";
import { lessonQuestions, selectTonightLesson } from "../lib/lessons";
import { readToken } from "../lib/prefs";
import type { DraftAnswer, Figure, Lesson, LessonSection } from "../lib/types";
import { useReviews } from "../state";

function countPhrase(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function draftKey(id: string): string {
  return `preceptorat.draft.${id}`;
}

function readDrafts(id: string): Record<string, DraftAnswer> {
  try {
    const raw = localStorage.getItem(draftKey(id));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DraftAnswer>;
  } catch {
    return {};
  }
}

function useTimer(lessonId: string, today: string): number {
  const key = `preceptorat.timer.${lessonId}.${today}`;
  const [ms, setMs] = useState(0);
  useEffect(() => {
    let accumulated = Number(sessionStorage.getItem(key) ?? "0") || 0;
    let runningSince: number | null = document.visibilityState === "visible" ? Date.now() : null;
    const tick = () => setMs(accumulated + (runningSince ? Date.now() - runningSince : 0));
    const timer = window.setInterval(tick, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && runningSince) {
        accumulated += Date.now() - runningSince;
        runningSince = null;
        sessionStorage.setItem(key, String(accumulated));
      } else if (document.visibilityState === "visible" && !runningSince) {
        runningSince = Date.now();
      }
      tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    tick();
    return () => {
      if (runningSince) accumulated += Date.now() - runningSince;
      sessionStorage.setItem(key, String(accumulated));
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [key]);
  return ms;
}

function TableFigure({ figure }: { figure: Figure }) {
  return (
    <figure className="figure">
      <figcaption>{figure.caption}</figcaption>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {figure.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {figure.rows.map((row) => (
              <tr key={row.join("|")}>
                {row.map((cell, index) => (
                  <td key={`${cell}-${index}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function SectionView({
  section,
  drafts,
  onDraft,
}: {
  section: LessonSection;
  drafts: Record<string, DraftAnswer>;
  onDraft: (code: string, draft: DraftAnswer) => void;
}) {
  return (
    <section className="block" id={section.id}>
      <header className="block-head">
        <h2>{section.title}</h2>
        {section.duration_min ? <p className="meta">{formatDuration(section.duration_min)}</p> : null}
      </header>
      {section.body ? <MarkdownView className="prose" source={section.body} /> : null}
      {section.figures?.map((figure) => (
        <TableFigure key={figure.caption} figure={figure} />
      ))}
      {section.excerpt ? (
        <figure className="excerpt">
          <Poem text={section.excerpt.text} />
          <figcaption>
            <cite>{section.excerpt.work}</cite>
            <span>{section.excerpt.locus}</span>
            <span>{section.excerpt.edition}</span>
            {section.excerpt.translator ? <span>{section.excerpt.translator}</span> : null}
          </figcaption>
          {section.excerpt.close_reading ? (
            <div className="close-reading">
              <p className="solution-label">Lecture</p>
              <MarkdownView source={section.excerpt.close_reading} />
            </div>
          ) : null}
        </figure>
      ) : null}
      {section.secondary ? (
        <div className="masters">
          <p className="meta">{section.secondary.work}</p>
          <MarkdownView source={section.secondary.idea} />
        </div>
      ) : null}
      {section.questions?.map((question) => (
        <QuestionCard
          key={question.code}
          question={question}
          draft={drafts[question.code] ?? { text: "", skipped: false, revealed: false }}
          onChange={(next) => onDraft(question.code, next)}
        />
      ))}
    </section>
  );
}

export function AujourdHui() {
  const { today } = useReviews();
  const lesson = useMemo(() => selectTonightLesson(lessons, today), [today]);
  if (!lesson) {
    return (
      <article className="sheet">
        <h1>Pas de leçon pour ce soir</h1>
        <p>Aucune leçon du dépôt n'est datée d'aujourd'hui ou d'avant, à l'heure de Maurice.</p>
      </article>
    );
  }
  return <LessonView lesson={lesson} today={today} />;
}

function LessonView({ lesson, today }: { lesson: Lesson; today: string }) {
  const elapsed = useTimer(lesson.id, today);
  const [drafts, setDrafts] = useState<Record<string, DraftAnswer>>(() => readDrafts(lesson.id));
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const stats = answerStats(lesson, drafts);
  const over = elapsed > lesson.duration_min.max * 60_000;

  useEffect(() => {
    setDrafts(readDrafts(lesson.id));
    setConfirming(false);
    setMessage("");
    setIssueUrl("");
  }, [lesson.id]);

  function update(code: string, draft: DraftAnswer) {
    if (draft.revealed && !canReveal(draft)) draft = { ...draft, revealed: false };
    const next = { ...drafts, [code]: draft };
    setDrafts(next);
    localStorage.setItem(draftKey(lesson.id), JSON.stringify(next));
  }

  async function send() {
    const token = readToken();
    if (!token) {
      setMessage("Pour envoyer, enregistre d'abord un jeton dans Réglages. Le brouillon reste sur cet appareil.");
      setConfirming(false);
      return;
    }
    setSending(true);
    setMessage("");
    try {
      const issue = await ensureLessonIssue(lesson.id, token);
      const minutes = Math.max(1, Math.round(elapsed / 60000));
      const comment = await postComment(issue.number, formatAnswerComment(lesson, drafts, minutes), token);
      setIssueUrl(comment.html_url);
      setMessage("Tes réponses sont dans le fil. Schopen pourra les lire.");
      setConfirming(false);
    } catch (error) {
      setMessage(error instanceof GithubError ? error.message : "L'envoi n'a pas abouti.");
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="sheet">
      <p className="kicker">{lesson.subject_label}</p>
      <h1>{lesson.title}</h1>
      <p className="lede">
        {formatLongDate(lesson.date)}
        {lesson.weekday ? ` · ${lesson.weekday}` : ""}. Durée prévue : {formatDuration(lesson.duration_min)}.
      </p>
      <div className={`timer ${over ? "over" : ""}`} role="timer" aria-label="Temps passé">
        <span>Temps passé</span>
        <strong>{formatClock(elapsed)}</strong>
        <span>sur {formatDuration(lesson.duration_min)}</span>
      </div>
      {over ? <p className="hint">Tu as dépassé la durée prévue. Tu peux t'arrêter à la question en cours.</p> : null}

      <section className="block" id="objectifs">
        <h2>Objectifs</h2>
        <ol className="objectives">
          {lesson.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ol>
      </section>

      <nav className="toc" aria-label="Sommaire de la leçon">
        <p className="meta">Sommaire</p>
        <ol>
          {lesson.sections.map((section) => (
            <li key={section.id}>
              <button type="button" onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                {section.title}
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => document.getElementById("retenir")?.scrollIntoView({ behavior: "smooth" })}>
              À retenir
            </button>
          </li>
          <li>
            <button type="button" onClick={() => document.getElementById("mot")?.scrollIntoView({ behavior: "smooth" })}>
              Mot du jour
            </button>
          </li>
        </ol>
      </nav>

      <p className="note">{lesson.student_note}</p>

      {lesson.sections.map((section) => (
        <SectionView key={section.id} section={section} drafts={drafts} onDraft={update} />
      ))}

      <section className="block" id="retenir">
        <h2>À retenir</h2>
        <ul>
          {lesson.retenir.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="block mot" id="mot">
        <h2>Mot du jour</h2>
        <p className="terme">{lesson.mot_du_jour.terme}</p>
        <MarkdownView source={lesson.mot_du_jour.texte} />
      </section>

      {lesson.sources?.length ? (
        <section className="block">
          <h2>Sources</h2>
          <ul className="sources">
            {lesson.sources.map((source) => (
              <li key={source.cite}>{source.cite}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="send">
        <p>
          {countPhrase(stats.filled, "réponse écrite", "réponses écrites")}, {countPhrase(stats.skipped, "passée", "passées")}, {countPhrase(stats.empty, "vide", "vides")}. {lessonQuestions(lesson).length} questions.
        </p>
        <p className="hint">Le brouillon est enregistré sur cet appareil.</p>
        {confirming ? (
          <div className="confirm">
            <p>Un seul commentaire sera ajouté au fil de cette leçon, avec chaque code.</p>
            <div className="actions">
              <button type="button" className="button primary" disabled={sending} onClick={() => void send()}>
                {sending ? "Envoi…" : "Confirmer l'envoi"}
              </button>
              <button type="button" className="button quiet" onClick={() => setConfirming(false)}>
                Revenir
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="button primary" onClick={() => setConfirming(true)}>
            Envoyer mes réponses au précepteur
          </button>
        )}
        {message ? (
          <p role="status" className="status">
            {message}
          </p>
        ) : null}
        {issueUrl ? (
          <p>
            <a href={`#/precepteur/${encodeURIComponent(lesson.id)}`}>Voir le fil ici</a>
            {" · "}
            <a href={issueUrl} rel="noopener noreferrer">
              Ouvrir sur GitHub
            </a>
          </p>
        ) : null}
      </footer>
    </article>
  );
}
