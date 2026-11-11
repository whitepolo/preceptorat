import { useEffect, useMemo, useState } from "react";
import { lessons } from "../content";
import { QuestionCard } from "../components/QuestionCard";
import { MarkdownView, Poem } from "../components/MarkdownView";
import { answerStats, canReveal, formatAnswerComment } from "../lib/answers";
import { formatClock, formatDuration, formatLongDate } from "../lib/dates";
import { GithubError, ensureLessonIssue, listRecentComments, postComment } from "../lib/github";
import { lessonForToday, lessonQuestions, selectTonightLesson } from "../lib/lessons";
import { isTutorMessage, stripTutorMarker } from "../lib/markdown";
import { readToken } from "../lib/prefs";
import type { DraftAnswer, Figure, FurtherReading, Lesson, LessonSection } from "../lib/types";
import { useReviews } from "../state";

function draftKey(id: string): string {
  return `preceptorat.draft.${id}`;
}

function stepKey(id: string): string {
  return `preceptorat.step.${id}`;
}

function readDrafts(id: string): Record<string, DraftAnswer> {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Record<string, DraftAnswer>) : {};
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

function lessonFromHash(today: string): Lesson | null {
  const hash = window.location.hash;
  const explicit = /^#\/lecon\/([^/]+)/.exec(hash);
  if (explicit) {
    const id = decodeURIComponent(explicit[1]);
    return lessons.find((lesson) => lesson.id === id && lesson.date <= today) ?? null;
  }
  if (hash.includes("/lire")) return lessonForToday(lessons, today);
  return null;
}

function countPhrase(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function Ring({ value }: { value: number }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - Math.min(1, Math.max(0, value)));
  return (
    <svg className="ring" viewBox="0 0 72 72" aria-hidden="true">
      <circle className="ring-track" cx="36" cy="36" r={radius} />
      <circle className="ring-value" cx="36" cy="36" r={radius} strokeDasharray={circ} strokeDashoffset={offset} />
    </svg>
  );
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
                <th key={column || "col"}>{column}</th>
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

function ReadingList({ entries }: { entries: FurtherReading[] }) {
  return (
    <ol className="readings">
      {entries.map((entry) => (
        <li key={entry.reference}>
          <p className="pill">{entry.type}</p>
          <p className="reference">{entry.reference}</p>
          <p>{entry.note}</p>
          {entry.citation ? (
            <blockquote className="pull">
              <p>{entry.citation}</p>
              {entry.citation_source ? <cite>{entry.citation_source}</cite> : null}
            </blockquote>
          ) : null}
          {entry.lien ? (
            <a href={entry.lien} rel="noopener noreferrer">
              Notice ou texte en accès ouvert
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function SectionBody({ section }: { section: LessonSection }) {
  return (
    <>
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
    </>
  );
}

type Step =
  | { id: string; label: string; kind: "intro" }
  | { id: string; label: string; kind: "section"; index: number }
  | { id: string; label: string; kind: "retenir" }
  | { id: string; label: string; kind: "plus" }
  | { id: string; label: string; kind: "mot" };

function buildSteps(lesson: Lesson): Step[] {
  const steps: Step[] = [{ id: "intro", label: "Objectifs", kind: "intro" }];
  lesson.sections.forEach((section, index) => {
    steps.push({ id: section.id, label: section.title, kind: "section", index });
  });
  steps.push({ id: "retenir", label: "À retenir", kind: "retenir" });
  if (lesson.pour_aller_plus_loin?.length) steps.push({ id: "plus", label: "Pour aller plus loin", kind: "plus" });
  steps.push({ id: "mot", label: "Mot du jour", kind: "mot" });
  return steps;
}

export function AujourdHui() {
  const { today, queue } = useReviews();
  const lesson = useMemo(() => lessonForToday(lessons, today), [today]);
  const recent = useMemo(() => {
    const latest = selectTonightLesson(lessons, today);
    if (latest && latest.date === today) return null;
    return latest;
  }, [today]);
  const [opened, setOpened] = useState<Lesson | null>(() => lessonFromHash(today));
  const [reply, setReply] = useState<string>("");

  useEffect(() => {
    const sync = () => setOpened(lessonFromHash(today));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [today]);

  useEffect(() => {
    let cancelled = false;
    listRecentComments(readToken() || undefined)
      .then((comments) => {
        const tutor = comments.find((comment) => isTutorMessage(comment.body));
        if (!cancelled && tutor) {
          const text = stripTutorMarker(tutor.body).replace(/\s+/g, " ").trim();
          setReply(text.slice(0, 180));
        }
      })
      .catch(() => {
        if (!cancelled) setReply("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (opened) return <LessonFlow lesson={opened} today={today} onClose={() => { window.location.hash = "#/aujourd-hui"; }} />;

  return (
    <article className="sheet home">
      <p className="kicker">Aujourd'hui</p>
      <h1>{lesson ? "La leçon du jour" : "La leçon du jour arrive à partir de 7\u00a0h"}</h1>
      {lesson ? (
        <LessonHero lesson={lesson} />
      ) : (
        <section className="empty-hero">
          <p>Schopen la dépose à partir de 7 h. En attendant, les révisions tiennent les matières déjà vues.</p>
          {recent ? (
            <p>
              <a href={`#/lecon/${encodeURIComponent(recent.id)}/lire`}>Reprendre la dernière leçon : {recent.title}</a>
            </p>
          ) : (
            <p className="hint">Aucune leçon au nouveau format n'est encore passée.</p>
          )}
        </section>
      )}
      <section className="hub">
        <a className="hub-card" href="#/revisions">
          <p className="kicker">Révisions</p>
          <p className="hub-number">{queue.length}</p>
          <p>{queue.length === 0 ? "Rien n'est dû pour cette séance." : queue.length === 1 ? "carte à revoir maintenant" : "cartes à revoir maintenant"}</p>
          <span className="button primary">Commencer les révisions</span>
        </a>
        <a className="hub-card" href="#/precepteur">
          <p className="kicker">Schopen</p>
          <p>{reply || "Pas encore de réponse dans le fil."}</p>
        </a>
      </section>
    </article>
  );
}

function LessonHero({ lesson }: { lesson: Lesson }) {
  const drafts = readDrafts(lesson.id);
  const questions = lessonQuestions(lesson);
  const done = questions.filter((question) => {
    const draft = drafts[question.code];
    return Boolean(draft && (draft.text.trim() || draft.skipped));
  }).length;
  const ratio = questions.length ? done / questions.length : 0;
  return (
    <section className="hero">
      <Ring value={ratio} />
      <div>
        <p className="kicker">{lesson.subject_label}</p>
        <h2>{lesson.title}</h2>
        <p>
          {done} sur {questions.length} questions tentées. Durée prévue : {formatDuration(lesson.duration_min)}.
        </p>
        <a className="button primary" href="#/aujourd-hui/lire">
          {done > 0 ? "Continuer la leçon" : "Commencer la leçon"}
        </a>
      </div>
    </section>
  );
}

function LessonFlow({ lesson, today, onClose }: { lesson: Lesson; today: string; onClose: () => void }) {
  const elapsed = useTimer(lesson.id, today);
  const steps = useMemo(() => buildSteps(lesson), [lesson]);
  const [step, setStep] = useState(() => {
    const saved = Number(localStorage.getItem(stepKey(lesson.id)) ?? "0");
    return Number.isFinite(saved) ? Math.min(Math.max(0, saved), steps.length - 1) : 0;
  });
  const [drafts, setDrafts] = useState<Record<string, DraftAnswer>>(() => readDrafts(lesson.id));
  const [sommaire, setSommaire] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const current = steps[step];
  const stats = answerStats(lesson, drafts);
  const over = elapsed > lesson.duration_min.max * 60_000;

  useEffect(() => {
    localStorage.setItem(stepKey(lesson.id), String(step));
    document.getElementById("contenu")?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [lesson.id, step]);

  function go(next: number) {
    setStep(Math.min(steps.length - 1, Math.max(0, next)));
    setSommaire(false);
  }

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

  const section = current.kind === "section" ? lesson.sections[current.index] : undefined;

  return (
    <article className="sheet lesson-flow">
      <div className="flow-top">
        <button type="button" className="button quiet" onClick={onClose}>
          Accueil
        </button>
        <p className="meta">
          {step + 1} / {steps.length}
        </p>
        <button type="button" className="button quiet" onClick={() => setSommaire(true)}>
          Sommaire
        </button>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label="Avancement de la leçon">
        <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <p className="kicker">{lesson.subject_label}</p>
      <h1>{current.label}</h1>
      <p className="timer-line">
        Temps passé <strong>{formatClock(elapsed)}</strong> sur {formatDuration(lesson.duration_min)}
        {over ? ". Tu peux t'arrêter à cette étape." : ""}
      </p>

      {current.kind === "intro" ? (
        <section>
          <p className="lede">{formatLongDate(lesson.date)}. {lesson.student_note}</p>
          <ol className="objectives">
            {lesson.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {section ? (
        <section>
          {section.duration_min ? <p className="meta">{formatDuration(section.duration_min)}</p> : null}
          <SectionBody section={section} />
          {section.questions?.map((question) => (
            <QuestionCard
              key={question.code}
              question={question}
              draft={drafts[question.code] ?? { text: "", skipped: false, revealed: false }}
              onChange={(next) => update(question.code, next)}
            />
          ))}
        </section>
      ) : null}

      {current.kind === "retenir" ? (
        <section className="block">
          <ul>
            {lesson.retenir.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {current.kind === "plus" ? (
        <section>
          <p className="lede">Lectures pour prolonger, sans remplacer l'extrait lu aujourd'hui.</p>
          <ReadingList entries={lesson.pour_aller_plus_loin ?? []} />
        </section>
      ) : null}

      {current.kind === "mot" ? (
        <section className="mot">
          <p className="terme">{lesson.mot_du_jour.terme}</p>
          <MarkdownView source={lesson.mot_du_jour.texte} />
          <footer className="send">
            <p>
              {countPhrase(stats.filled, "réponse écrite", "réponses écrites")}, {countPhrase(stats.skipped, "passée", "passées")}, {countPhrase(stats.empty, "vide", "vides")}.
            </p>
            <p className="hint">Le brouillon est enregistré sur cet appareil.</p>
            {confirming ? (
              <div className="confirm">
                <p>Un seul commentaire sera ajouté au fil, avec chaque code.</p>
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
              </p>
            ) : null}
          </footer>
        </section>
      ) : null}

      <div className="step-nav">
        <button type="button" className="button" disabled={step === 0} onClick={() => go(step - 1)}>
          Précédent
        </button>
        <button type="button" className="button primary" disabled={step === steps.length - 1} onClick={() => go(step + 1)}>
          Suivant
        </button>
      </div>

      {sommaire ? (
        <div className="sheet-overlay" role="dialog" aria-modal="true" aria-label="Sommaire">
          <div className="sheet-panel">
            <header>
              <h2>Sommaire</h2>
              <button type="button" className="button quiet" onClick={() => setSommaire(false)}>
                Fermer
              </button>
            </header>
            <ol>
              {steps.map((item, index) => (
                <li key={item.id}>
                  <button type="button" aria-current={index === step ? "step" : undefined} onClick={() => go(index)}>
                    {item.label}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </article>
  );
}
