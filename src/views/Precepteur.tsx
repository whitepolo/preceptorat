import { useEffect, useMemo, useState } from "react";
import { lessons } from "../content";
import { MarkdownView } from "../components/MarkdownView";
import { formatLongDate } from "../lib/dates";
import {
  ensureDialogueIssue,
  ensureLessonIssue,
  GithubError,
  listComments,
  listIssues,
  postComment,
  type IssueComment,
  type IssueSummary,
} from "../lib/github";
import { pastLessons } from "../lib/lessons";
import { isTutorMessage, stripTutorMarker } from "../lib/markdown";
import { readToken } from "../lib/prefs";
import { useReviews } from "../state";

interface Thread {
  id: string;
  title: string;
  detail: string;
  issue?: IssueSummary;
}

export function Precepteur({ threadId }: { threadId?: string }) {
  const { today } = useReviews();
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("Lecture du fil.");
  const [sending, setSending] = useState(false);
  const token = readToken();
  const selected = threadId || "dialogue";

  const threads = useMemo(() => buildThreads(issues, today), [issues, today]);
  const current = threads.find((thread) => thread.id === selected) ?? threads[0];

  useEffect(() => {
    let cancelled = false;
    setStatus(token ? "Lecture du fil." : "Lecture publique du dépôt.");
    listIssues(token || undefined)
      .then((data) => {
        if (!cancelled) {
          setIssues(data);
          setStatus("");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof GithubError ? error.message : "Les fils ne se chargent pas.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!current?.issue) {
      setComments([]);
      return;
    }
    let cancelled = false;
    listComments(current.issue.number, token || undefined)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof GithubError ? error.message : "Les messages ne se chargent pas.");
      });
    return () => {
      cancelled = true;
    };
  }, [current?.issue, token]);

  async function send() {
    const body = text.trim();
    if (!body || !current) return;
    if (!token) {
      setStatus("Pour écrire, colle un jeton dans Réglages. La lecture, elle, reste ouverte.");
      return;
    }
    setSending(true);
    try {
      const issue =
        current.issue ??
        (current.id === "dialogue" ? await ensureDialogueIssue(token) : await ensureLessonIssue(current.id, token));
      const comment = await postComment(issue.number, `<!-- sebastien -->\n\n${body}\n`, token);
      setComments((prev) => [...prev, comment]);
      setIssues((prev) => (prev.some((item) => item.number === issue.number) ? prev : [...prev, issue]));
      setText("");
      setStatus("Message envoyé. Schopen sera prévenu.");
    } catch (error) {
      setStatus(error instanceof GithubError ? error.message : "L'envoi n'a pas abouti.");
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="sheet chat-page">
      <h1>Précepteur</h1>
      <p className="lede">Schopen répond dans le même fil. Ses messages portent une marque invisible. Les tiens n'en ont pas.</p>
      <div className="thread-list" role="tablist" aria-label="Fils">
        {threads.map((thread) => (
          <a key={thread.id} href={`#/precepteur/${encodeURIComponent(thread.id)}`} aria-current={thread.id === current?.id ? "page" : undefined}>
            <strong>{thread.title}</strong>
            <span>{thread.detail}</span>
          </a>
        ))}
      </div>
      {current ? (
        <section className="chat" aria-label={current.title}>
          <header>
            <h2>{current.title}</h2>
            {current.issue ? (
              <a href={current.issue.html_url} rel="noopener noreferrer">
                GitHub
              </a>
            ) : (
              <p className="meta">Pas encore de fil. Le premier message le crée.</p>
            )}
          </header>
          <div className="messages">
            {comments.length === 0 ? <p className="hint">Aucun message pour l'instant.</p> : null}
            {comments.map((comment) => {
              const tutor = isTutorMessage(comment.body);
              return (
                <article key={comment.id} className={tutor ? "bubble tutor" : "bubble learner"}>
                  <header>
                    <span>{tutor ? "Schopen" : "Sébastien"}</span>
                    <time dateTime={comment.created_at}>
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Indian/Mauritius" }).format(new Date(comment.created_at))}
                    </time>
                  </header>
                  <MarkdownView source={stripTutorMarker(comment.body)} />
                </article>
              );
            })}
          </div>
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="field">
              <span>Message</span>
              <textarea rows={4} value={text} onChange={(event) => setText(event.target.value)} placeholder="Écrire à Schopen" />
            </label>
            <button type="submit" className="button primary" disabled={sending || !text.trim()}>
              {sending ? "Envoi…" : "Envoyer"}
            </button>
          </form>
        </section>
      ) : null}
      {status ? (
        <p className="hint" role="status">
          {status}
        </p>
      ) : null}
    </article>
  );
}

function buildThreads(issues: IssueSummary[], today: string): Thread[] {
  const dialogue = issues.find((issue) => issue.labels.includes("dialogue"));
  const byTitle = new Map(issues.filter((issue) => issue.labels.includes("leçon")).map((issue) => [issue.title, issue]));
  const lessonThreads = pastLessons(lessons, today).map((lesson) => ({
    id: lesson.id,
    title: lesson.subject_label,
    detail: formatLongDate(lesson.date),
    issue: byTitle.get(lesson.id),
  }));
  return [
    { id: "dialogue", title: "Dialogue", detail: "Conversation libre", issue: dialogue },
    ...lessonThreads,
  ];
}
