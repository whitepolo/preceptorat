import { useEffect, useMemo, useState } from "react";
import { lessons } from "../content";
import { MarkdownView } from "../components/MarkdownView";
import { formatLongDate, formatStamp } from "../lib/dates";
import {
  GithubError,
  listComments,
  listIssues,
  type IssueComment,
  type IssueSummary,
} from "../lib/github";
import { buildIssueLinks, openFirstIssue, prepareIssueWindow, type IssueLink } from "../lib/issueLink";
import { markSent, readSentMap } from "../lib/localProgress";
import { pastLessons } from "../lib/lessons";
import { isTutorMessage, stripTutorMarker } from "../lib/markdown";
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
  const [status, setStatus] = useState("Lecture du fil public.");
  const [sending, setSending] = useState(false);
  const [links, setLinks] = useState<IssueLink[]>([]);
  const [sentAt, setSentAt] = useState<string | null>(() => readSentMap().dialogue ?? null);
  const selected = threadId || "dialogue";

  const threads = useMemo(() => buildThreads(issues, today), [issues, today]);
  const current = threads.find((thread) => thread.id === selected) ?? threads[0];

  useEffect(() => {
    let cancelled = false;
    setStatus("Lecture du fil public.");
    listIssues()
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
  }, []);

  useEffect(() => {
    if (!current?.issue) {
      setComments([]);
      return;
    }
    let cancelled = false;
    listComments(current.issue.number)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof GithubError ? error.message : "Les messages ne se chargent pas.");
      });
    return () => {
      cancelled = true;
    };
  }, [current?.issue]);

  async function send() {
    const body = text.trim();
    if (!body || !current) return;
    const popup = prepareIssueWindow();
    setSending(true);
    const next = await buildIssueLinks({
      type: current.id === "dialogue" ? "dialogue" : "reponses",
      lesson_id: current.id === "dialogue" ? null : current.id,
      date: today,
      human: body,
      message: body,
      ...(current.id === "dialogue" ? {} : { answers: { message: body } }),
    });
    const when = new Date().toISOString();
    markSent(current.id === "dialogue" ? "dialogue" : `reponses:${current.id}`, when);
    if (current.id === "dialogue") setSentAt(when);
    setLinks(next);
    openFirstIssue(next, popup);
    setText("");
    setStatus(`Envoyé le ${formatStamp(when)}. Sur GitHub, appuie sur Submit.`);
    setSending(false);
  }

  return (
    <article className="sheet chat-page">
      <h1>Précepteur</h1>
      <p className="lede">Schopen répond dans le fil public. Pour lui écrire, ouvre GitHub et appuie sur Submit.</p>
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
              <a href={current.issue.html_url} target="_blank" rel="noopener noreferrer">
                Voir sur GitHub
              </a>
            ) : (
              <p className="meta">Pas encore de message public. Le bouton ci-dessous en prépare un.</p>
            )}
          </header>
          <div className="messages">
            {current.issue?.body ? (
              <article className={isTutorMessage(current.issue.body) ? "bubble tutor" : "bubble learner"}>
                <header>
                  <span>{isTutorMessage(current.issue.body) ? "Schopen" : "Sébastien"}</span>
                  <time dateTime={current.issue.updated_at}>{formatStamp(current.issue.updated_at)}</time>
                </header>
                <MarkdownView source={stripTutorMarker(current.issue.body)} />
              </article>
            ) : null}
            {comments.length === 0 && !current.issue?.body ? <p className="hint">Aucun message pour l'instant.</p> : null}
            {comments.map((comment) => {
              const tutor = isTutorMessage(comment.body);
              return (
                <article key={comment.id} className={tutor ? "bubble tutor" : "bubble learner"}>
                  <header>
                    <span>{tutor ? "Schopen" : "Sébastien"}</span>
                    <time dateTime={comment.created_at}>
                      {formatStamp(comment.created_at)}
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
              {sending ? "Ouverture…" : "Envoyer au précepteur"}
            </button>
            {sentAt && current.id === "dialogue" ? <p className="hint">Envoyé le {formatStamp(sentAt)}.</p> : null}
            {links.map((link) => (
              <a key={link.part} href={link.url} target="_blank" rel="noopener noreferrer">
                {link.parts > 1 ? `Ouvrir la partie ${link.part}/${link.parts}` : "Ouvrir sur GitHub"}
              </a>
            ))}
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
  const dialogue = issues.find((issue) => issue.labels.includes("dialogue") || issue.title === "Dialogue" || issue.title.startsWith("Dialogue ("));
  const lessonThreads = pastLessons(lessons, today).map((lesson) => ({
    id: lesson.id,
    title: lesson.subject_label,
    detail: formatLongDate(lesson.date),
    issue: issues.find((issue) => issue.title === lesson.id || issue.title.startsWith(`Réponses ${lesson.id}`)),
  }));
  return [
    { id: "dialogue", title: "Dialogue", detail: "Conversation libre", issue: dialogue },
    ...lessonThreads,
  ];
}
