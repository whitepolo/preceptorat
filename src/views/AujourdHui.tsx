import { useEffect, useMemo, useState } from "react";
import { lessons } from "../content";
import { QuestionCard } from "../components/QuestionCard";
import { MarkdownView, Poem } from "../components/MarkdownView";
import { answerStats, canReveal, formatAnswerComment } from "../lib/answers";
import { formatClock, formatDuration, formatLongDate, formatStamp } from "../lib/dates";
import { listComments, listIssues, listRecentComments } from "../lib/github";
import { buildIssueLinks, openFirstIssue, prepareIssueWindow, type IssueLink } from "../lib/issueLink";
import { markSent, readSentMap } from "../lib/localProgress";
import { accessibleLesson, excerptSides, lessonForToday, lessonHash, lessonOnDate, lessonQuestions, pastLessons, selectTonightLesson } from "../lib/lessons";
import { isTutorMessage, stripTutorMarker } from "../lib/markdown";
import { answerText, hasAttempt } from "../lib/response";
import { splitTutorNotes } from "../lib/tutorNotes";
import type { DraftAnswer, Figure, FurtherReading, Lesson, LessonQuestion, LessonSection } from "../lib/types";
import { isWeekend, schoolWeek, studiedDates, studyStreak, weekDayMark } from "../lib/week";
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

function outcomeOf(question: LessonQuestion, draft: DraftAnswer | undefined): "reussi" | "revoir" | "ouvert" | "exemple" {
  if (question.kind === "worked") return "exemple";
  if (draft?.auto === "juste" || draft?.judgment === "juste") return "reussi";
  if (draft?.auto === "faux" || draft?.judgment === "faux" || draft?.judgment === "partiel" || draft?.skipped || !hasAttempt(draft)) return "revoir";
  return "ouvert";
}

function ResultList({ questions, empty }: { questions: LessonQuestion[]; empty: string }) {
  if (!questions.length) return <p className="hint">{empty}</p>;
  return (
    <ul className="result-list">
      {questions.map((question) => (
        <li key={question.code}>{question.prompt.split("\n")[0].replace(/[*_`]/g, "")}</li>
      ))}
    </ul>
  );
}

function Synthesis({ lesson, drafts }: { lesson: Lesson; drafts: Record<string, DraftAnswer> }) {
  const questions = lessonQuestions(lesson);
  const reussi = questions.filter((question) => outcomeOf(question, drafts[question.code]) === "reussi");
  const ouvert = questions.filter((question) => outcomeOf(question, drafts[question.code]) === "ouvert");
  const revoir = questions.filter((question) => outcomeOf(question, drafts[question.code]) === "revoir");
  return (
    <div className="synthesis">
      <h2>Ce qui tient</h2>
      <ResultList questions={reussi} empty="Rien n'est encore marqué juste." />
      <h2>À relire</h2>
      <ResultList questions={ouvert} empty="Aucune réponse en attente d'évaluation." />
      <h2>À revoir</h2>
      <ResultList questions={revoir} empty="Rien à reprendre." />
    </div>
  );
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
      {section.excerpt ? <ExcerptView excerpt={section.excerpt} /> : null}
      {section.secondary ? (
        <div className="masters">
          <p className="meta">{section.secondary.work}</p>
          <MarkdownView source={section.secondary.idea} />
        </div>
      ) : null}
    </>
  );
}

function ExcerptView({ excerpt }: { excerpt: NonNullable<LessonSection["excerpt"]> }) {
  const sides = excerptSides(excerpt);
  return (
    <figure className="excerpt">
      <figcaption>
        <cite>{excerpt.work}</cite>
        <span>{excerpt.locus}</span>
        <span>{excerpt.edition}</span>
        {excerpt.translator ? <span>{excerpt.translator}</span> : null}
      </figcaption>
      {sides.original ? (
        <div className="bilingual">
          <div>
            <p className="solution-label">Texte</p>
            <Poem text={sides.original} />
          </div>
          <div>
            <p className="solution-label">Traduction</p>
            <Poem text={sides.translation} />
          </div>
        </div>
      ) : (
        <Poem text={sides.translation} />
      )}
      {sides.reading ? (
        <div className="close-reading">
          <p className="solution-label">Lecture</p>
          <MarkdownView source={sides.reading} />
        </div>
      ) : null}
    </figure>
  );
}

type Step =
  | { id: string; label: string; kind: "intro" }
  | { id: string; label: string; kind: "section"; index: number }
  | { id: string; label: string; kind: "retenir" }
  | { id: string; label: string; kind: "plus" }
  | { id: string; label: string; kind: "mot" }
  | { id: string; label: string; kind: "synthese" };

function buildSteps(lesson: Lesson): Step[] {
  const steps: Step[] = [{ id: "intro", label: "Objectifs", kind: "intro" }];
  lesson.sections.forEach((section, index) => {
    steps.push({ id: section.id, label: section.title, kind: "section", index });
  });
  steps.push({ id: "retenir", label: "À retenir", kind: "retenir" });
  if (lesson.pour_aller_plus_loin?.length) steps.push({ id: "plus", label: "Pour aller plus loin", kind: "plus" });
  steps.push({ id: "mot", label: "Mot du jour", kind: "mot" });
  steps.push({ id: "synthese", label: "Synthèse", kind: "synthese" });
  return steps;
}

export function AujourdHui() {
  const { today, queue, pending } = useReviews();
  const lesson = useMemo(() => lessonForToday(lessons, today), [today]);
  const recent = useMemo(() => {
    const latest = selectTonightLesson(lessons, today);
    if (latest && latest.date === today) return null;
    return latest;
  }, [today]);
  const [reply, setReply] = useState<string>("");
  const archive = useMemo(() => pastLessons(lessons, today).slice(0, 4), [today]);

  useEffect(() => {
    let cancelled = false;
    listRecentComments()
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

  const weekend = isWeekend(today);
  const week = schoolWeek(today);
  const studied = studiedDates();
  const streak = studyStreak(today, studied);

  return (
    <article className="sheet home">
      <p className="kicker">Aujourd'hui</p>
      <h1>{lesson ? lesson.subject_label : weekend ? "Le week-end est libre" : "La leçon du jour arrive à partir de 7\u00a0h"}</h1>
      {lesson ? (
        <LessonHero lesson={lesson} />
      ) : (
        <section className="empty-hero">
          <p>
            {weekend
              ? "Pas de leçon le samedi ni le dimanche. Lundi, le latin reprend."
              : "Schopen la dépose à partir de 7 h. En attendant, les révisions tiennent les matières déjà vues."}
          </p>
          {recent ? (
            <p>
              <a href={lessonHash(recent.id)}>Reprendre la dernière leçon : {recent.title}</a>
            </p>
          ) : null}
        </section>
      )}
      <section className="week" aria-label="Semaine">
        {week.map((day) => {
          const done = studied.has(day.date);
          const isToday = day.date === today;
          const published = lessonOnDate(lessons, day.date);
          const state = weekDayMark(day.date, today, Boolean(published), done);
          const open = Boolean(published && published.date <= today);
          const className = isToday ? "week-day today" : done ? "week-day done" : "week-day";
          const body = (
            <>
              <p className="kicker">{day.label}</p>
              <p>{day.subject}</p>
              <p className="meta">{state}</p>
            </>
          );
          return open && published ? (
            <a key={day.date} className={className} href={lessonHash(published.id)}>
              {body}
            </a>
          ) : (
            <article key={day.date} className={className}>
              {body}
            </article>
          );
        })}
      </section>
      <p className="streak">
        Série : <strong>{streak}</strong> {streak === 1 ? "jour de semaine" : "jours de semaine"}
      </p>
      {archive.length > 0 ? (
        <section className="block">
          <h2>Mes leçons</h2>
          <ul className="quiet-list">
            {archive.map((item) => (
              <li key={item.id}>
                <a href={lessonHash(item.id)}>
                  {item.subject_label}, {formatLongDate(item.date)}
                </a>
              </li>
            ))}
          </ul>
          <a href="#/bibliotheque">Toutes les leçons</a>
        </section>
      ) : null}
      <section className="hub">
        <a className="hub-card" href="#/revisions">
          <p className="kicker">Révisions</p>
          <p className="hub-number">{queue.length}</p>
          <p>{queue.length === 0 ? "Rien n'est dû pour cette séance." : queue.length === 1 ? "carte à revoir maintenant" : "cartes à revoir maintenant"}</p>
          {pending.length > 0 ? (
            <p className="hint">{pending.length === 1 ? "1 révision pas encore envoyée." : `${pending.length} révisions pas encore envoyées.`}</p>
          ) : null}
          <span className="button primary">Commencer les révisions</span>
        </a>
        <a className="hub-card" href="#/precepteur">
          <p className="kicker">Schopen</p>
          <p>{reply || "Pas encore de réponse de Schopen."}</p>
        </a>
      </section>
    </article>
  );
}

function LessonHero({ lesson }: { lesson: Lesson }) {
  const drafts = readDrafts(lesson.id);
  const questions = lessonQuestions(lesson);
  const done = questions.filter((question) => hasAttempt(drafts[question.code]) || drafts[question.code]?.skipped).length;
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
        <a className="button primary" href={lessonHash(lesson.id)}>
          {done > 0 ? "Continuer la leçon" : "Commencer la leçon"}
        </a>
      </div>
    </section>
  );
}

export function LessonReader({ lessonId }: { lessonId: string }) {
  const { today } = useReviews();
  const lesson = useMemo(() => {
    if (lessonId === "@today") return lessonForToday(lessons, today);
    return accessibleLesson(lessons, lessonId, today);
  }, [lessonId, today]);
  if (!lesson) {
    return (
      <article className="sheet">
        <h1>Cette leçon n'est pas ouverte</h1>
        <p className="lede">Elle n'est pas encore publiée, ou son jour n'est pas arrivé.</p>
        <a className="button" href="#/aujourd-hui">Retour à l'accueil</a>
      </article>
    );
  }
  return <LessonFlow lesson={lesson} today={today} onClose={() => { window.location.hash = "#/aujourd-hui"; }} />;
}

function LessonFlow({ lesson, today, onClose }: { lesson: Lesson; today: string; onClose: () => void }) {
  const { grade } = useReviews();
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
  const [links, setLinks] = useState<IssueLink[]>([]);
  const [sentAt, setSentAt] = useState<string | null>(() => readSentMap()[`reponses:${lesson.id}`] ?? null);
  const [tutorByCode, setTutorByCode] = useState<Record<string, string[]>>({});
  const [tutorGeneral, setTutorGeneral] = useState<string[]>([]);
  const current = steps[step];
  const stats = answerStats(lesson, drafts);
  const over = elapsed > lesson.duration_min.max * 60_000;

  useEffect(() => {
    let cancelled = false;
    const codes = new Set(lessonQuestions(lesson).map((question) => question.code));
    listIssues()
      .then(async (issues) => {
        const match = issues.find((issue) => issue.title === lesson.id || issue.title.startsWith(`Réponses ${lesson.id}`));
        if (!match) return { byCode: {}, general: [] as string[] };
        const comments = await listComments(match.number);
        return splitTutorNotes([match.body, ...comments.map((comment) => comment.body)], codes);
      })
      .then((notes) => {
        if (cancelled || !notes) return;
        setTutorByCode(notes.byCode);
        setTutorGeneral(notes.general);
      })
      .catch(() => {
        if (!cancelled) {
          setTutorByCode({});
          setTutorGeneral([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lesson]);

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
    const popup = prepareIssueWindow();
    setSending(true);
    setMessage("");
    const minutes = Math.max(1, Math.round(elapsed / 60000));
    const answers: Record<string, string> = {};
    for (const question of lessonQuestions(lesson)) {
      const draft = drafts[question.code];
      const text = answerText(draft);
      answers[question.code] = text || (draft?.skipped ? "(passée)" : "(sans réponse)");
    }
    const human = formatAnswerComment(lesson, drafts, minutes).replace(/^<!-- sebastien -->\s*/, "");
    const next = await buildIssueLinks({
      type: "reponses",
      lesson_id: lesson.id,
      date: today,
      human,
      answers,
      elapsed_min: minutes,
    });
    const when = new Date().toISOString();
    markSent(`reponses:${lesson.id}`, when);
    setSentAt(when);
    setLinks(next);
    openFirstIssue(next, popup);
    setMessage(`Envoyé le ${formatStamp(when)}. Sur GitHub, appuie sur Submit.`);
    setConfirming(false);
    setSending(false);
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
          Vue d'ensemble
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
          <p className="lede">{formatLongDate(lesson.date)}. {formatDuration(lesson.duration_min)}.</p>
          <ol className="objectives">
            {lesson.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ol>
          {lesson.student_note ? <p className="hint">{lesson.student_note}</p> : null}
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
              draft={drafts[question.code]}
              notes={tutorByCode[question.code]}
              onChange={(next) => update(question.code, next)}
              onGrade={(name) => {
                if (question.card_id) void grade(question.card_id, name);
              }}
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
        </section>
      ) : null}

      {current.kind === "synthese" ? (
        <section>
          <Synthesis lesson={lesson} drafts={drafts} />
          {tutorGeneral.map((note) => (
            <aside key={note.slice(0, 40)} className="tutor-note">
              <p className="solution-label">Schopen</p>
              <MarkdownView source={note} />
            </aside>
          ))}
          <footer className="send">
            <p>
              {countPhrase(stats.filled, "réponse écrite", "réponses écrites")}, {countPhrase(stats.skipped, "passée", "passées")}, {countPhrase(stats.empty, "vide", "vides")}.
            </p>
            <p className="hint">Le brouillon est enregistré sur cet appareil.</p>
            {confirming ? (
              <div className="confirm">
                <p>GitHub s'ouvre avec tes réponses déjà écrites. Tu n'as plus qu'à appuyer sur Submit.</p>
                <div className="actions">
                  <button type="button" className="button primary" disabled={sending} onClick={() => void send()}>
                    {sending ? "Ouverture…" : "Envoyer au précepteur"}
                  </button>
                  <button type="button" className="button quiet" onClick={() => setConfirming(false)}>
                    Revenir
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="button primary" onClick={() => setConfirming(true)}>
                Envoyer au précepteur
              </button>
            )}
            {message ? (
              <p role="status" className="status">
                {message}
              </p>
            ) : null}
            {sentAt ? <p className="hint">Envoyé le {formatStamp(sentAt)}.</p> : null}
            {links.map((link) => (
              <p key={link.part}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.parts > 1 ? `Ouvrir la partie ${link.part}/${link.parts}` : "Ouvrir sur GitHub"}
                </a>
              </p>
            ))}
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
        <div className="sheet-overlay" role="dialog" aria-modal="true" aria-label="Vue d'ensemble">
          <div className="sheet-panel">
            <header>
              <h2>Vue d'ensemble</h2>
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
