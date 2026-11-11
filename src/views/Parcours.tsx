import { useMemo } from "react";
import { catalog, plan, progression } from "../content";
import { addDays, formatLongDate } from "../lib/dates";
import { subjectLabel } from "../lib/lessons";
import { useReviews } from "../state";

export function Parcours() {
  const { today, state } = useReviews();
  const activeDays = useMemo(() => {
    const days = new Set(progression.activities.map((item) => item.date));
    for (const card of Object.values(state.cards)) {
      if (card.last_review) days.add(new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Mauritius", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(card.last_review)));
    }
    return days;
  }, [state]);
  const run = currentRun(activeDays, today);
  const monthCount = countRecent(activeDays, today, 28);
  const fragile = catalog.cards
    .filter((card) => (state.cards[card.id]?.lapses ?? 0) > 0)
    .sort((a, b) => (state.cards[b.id]?.lapses ?? 0) - (state.cards[a.id]?.lapses ?? 0) || a.id.localeCompare(b.id));

  return (
    <article className="sheet">
      <h1>Parcours</h1>
      <p className="lede">{plan.objective}</p>
      <p>
        Séance vers {plan.session.hour}, {plan.session.duration_min.min} à {plan.session.duration_min.max} minutes. {plan.session.trigger}
      </p>

      <section className="block">
        <h2>Assiduité</h2>
        <p className="stats">
          <span>
            <strong>{monthCount}</strong> jours sur 28
          </span>
          <span>
            <strong>{run}</strong> {run > 1 ? "jours de suite" : "jour de suite"}
          </span>
        </p>
        <Heatmap today={today} active={activeDays} />
        <ul className="quiet-list">
          {progression.activities.slice(-6).reverse().map((item) => (
            <li key={`${item.date}-${item.summary}`}>
              <time dateTime={item.date}>{formatLongDate(item.date)}</time>
              <span>{item.summary}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h2>Semaine</h2>
        <ul className="rotation">
          {plan.rotation.map((day) => (
            <li key={day.weekday}>
              <strong>{day.weekday}</strong>
              <span>{subjectLabel(day.subject)}</span>
              <p>{day.note}</p>
            </li>
          ))}
        </ul>
      </section>

      {plan.points_fragiles.length > 0 ? (
        <section className="block">
          <h2>Points fragiles</h2>
          <p className="hint">Ce sont les cartes qui ont déjà échoué. La réponse n'est pas affichée : elle se retrouve en révision.</p>
          <ul className="fragile">
            {plan.points_fragiles.map((point) => {
              const card = catalog.cards.find((item) => item.id === point.card_id);
              return (
                <li key={point.card_id}>
                  <span className="code">{point.card_id}</span>
                  <p>{card?.prompt}</p>
                  <p className="hint">{point.note}</p>
                </li>
              );
            })}
          </ul>
          {fragile.length > plan.points_fragiles.length ? (
            <p className="meta">{fragile.length} cartes portent au moins un échec dans l'état FSRS.</p>
          ) : null}
        </section>
      ) : null}

      {plan.subjects.map((subject) => (
        <section className="block" key={subject.id} id={`matiere-${subject.id}`}>
          <header className="block-head">
            <h2>{subject.label}</h2>
            <p className="pill">{subject.status}</p>
          </header>
          <p>{subject.position}</p>
          <p className="hint">{subject.summary}</p>
          {subject.modules.map((module) => {
            const done = module.lessons.filter((lesson) => lesson.status === "faite").length;
            const ratio = module.lessons.length ? done / module.lessons.length : 0;
            return (
              <article key={module.id} className={module.current ? "module current" : "module"}>
                <h3>
                  {module.title}
                  {module.span ? <span className="meta"> {module.span}</span> : null}
                </h3>
                <p className="meta">
                  {done} leçon{done > 1 ? "s" : ""} faite{done > 1 ? "s" : ""} sur {module.lessons.length}. Avancement du module : {Math.round(ratio * 100)} %.
                </p>
                <p className="hint">
                  Seuil de maîtrise : {Math.round(plan.mastery_threshold * 100)} %. Aucun contrôle chiffré n'est encore enregistré.
                </p>
                {module.support ? <p className="hint">Lecture d'appui : {module.support}</p> : null}
                <ol>
                  {module.lessons.map((lesson) => (
                    <li key={lesson.title}>
                      <span className={`status status-${lesson.status.replace(/\s/g, "-")}`}>{lesson.status}</span> {lesson.title}
                      {lesson.date ? <span className="meta"> {lesson.date}</span> : null}
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </section>
      ))}

      {plan.closed.length > 0
        ? plan.closed.map((item) => (
            <section className="block" key={item.id}>
              <h2>{item.label}</h2>
              <p>
                Le {formatLongDate(item.closed_on)}. {item.note}
              </p>
            </section>
          ))
        : null}

      <section className="block">
        <h2>Principes</h2>
        <ul>
          {plan.principles.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function currentRun(days: Set<string>, today: string): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  if (!days.has(cursor)) return 0;
  let count = 0;
  while (days.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function countRecent(days: Set<string>, today: string, span: number): number {
  let count = 0;
  let cursor = today;
  for (let i = 0; i < span; i += 1) {
    if (days.has(cursor)) count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function Heatmap({ today, active }: { today: string; active: Set<string> }) {
  const weeks = 17;
  const start = mondayOnOrBefore(addDays(today, -(weeks - 1) * 7));
  const columns: string[][] = [];
  let cursor = start;
  for (let week = 0; week < weeks; week += 1) {
    const column: string[] = [];
    for (let day = 0; day < 7; day += 1) {
      column.push(cursor);
      cursor = addDays(cursor, 1);
    }
    columns.push(column);
  }
  return (
    <div className="heatmap" role="img" aria-label="Calendrier des jours de travail, dix-sept semaines">
      {columns.map((column) => (
        <div key={column[0]} className="heat-col">
          {column.map((day) => (
            <span
              key={day}
              className={day > today ? "heat future" : active.has(day) ? "heat on" : "heat off"}
              title={`${formatLongDate(day)}${active.has(day) ? ", activité" : ""}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function mondayOnOrBefore(day: string): string {
  const date = new Date(`${day}T12:00:00+04:00`);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Indian/Mauritius", weekday: "short" }).format(date);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  return addDays(day, -Math.max(0, index));
}
