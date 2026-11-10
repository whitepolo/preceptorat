import { useMemo, useState } from "react";
import { catalog, lessons, library } from "../content";
import { MarkdownView } from "../components/MarkdownView";
import { formatLongDate } from "../lib/dates";
import { pastLessons } from "../lib/lessons";
import { useReviews } from "../state";

type Pane = "lecons" | "vocabulaire" | "lectures";

export function Bibliotheque() {
  const { today } = useReviews();
  const [pane, setPane] = useState<Pane>("lecons");
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("toutes");
  const [role, setRole] = useState("tous");
  const past = useMemo(() => pastLessons(lessons, today), [today]);
  const needle = query.trim().toLowerCase();

  const filteredLessons = past.filter((lesson) => {
    if (subject !== "toutes" && lesson.subject !== subject) return false;
    if (!needle) return true;
    const haystack = `${lesson.title} ${lesson.subject_label} ${lesson.mot_du_jour.terme} ${lesson.objectives.join(" ")}`.toLowerCase();
    return haystack.includes(needle);
  });

  const vocab = [
    ...past.map((lesson) => ({
      term: lesson.mot_du_jour.terme,
      text: lesson.mot_du_jour.texte,
      source: lesson.subject_label,
    })),
    ...catalog.cards
      .filter((card) => card.kind === "vocabulaire")
      .map((card) => ({ term: card.prompt, text: card.answer, source: card.subject_label })),
  ].filter((item) => !needle || `${item.term} ${item.text} ${item.source}`.toLowerCase().includes(needle));

  const subjects = [...new Set(past.map((lesson) => lesson.subject))];

  return (
    <article className="sheet">
      <h1>Bibliothèque</h1>
      <p className="lede">Les leçons déjà dues, le vocabulaire, et les lectures d'appui. Une leçon datée d'un jour futur reste cachée jusqu'à ce jour.</p>
      <div className="panes" role="tablist" aria-label="Rayons">
        {(
          [
            ["lecons", "Leçons"],
            ["vocabulaire", "Vocabulaire"],
            ["lectures", "Lectures"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={pane === id} className={pane === id ? "on" : ""} onClick={() => setPane(id)}>
            {label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Recherche</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" />
      </label>

      {pane === "lecons" ? (
        <section>
          <label className="field inline">
            <span>Matière</span>
            <select value={subject} onChange={(event) => setSubject(event.target.value)}>
              <option value="toutes">Toutes</option>
              {subjects.map((id) => (
                <option key={id} value={id}>
                  {past.find((lesson) => lesson.subject === id)?.subject_label}
                </option>
              ))}
            </select>
          </label>
          {filteredLessons.length === 0 ? <p>Aucune leçon ne correspond.</p> : null}
          <ul className="catalog">
            {filteredLessons.map((lesson) => (
              <li key={lesson.id}>
                <p className="kicker">{lesson.subject_label}</p>
                <h2>{lesson.title}</h2>
                <p className="meta">{formatLongDate(lesson.date)}</p>
                <p>Mot du jour : {lesson.mot_du_jour.terme}</p>
                <a href={`#/precepteur/${encodeURIComponent(lesson.id)}`}>Fil de la leçon</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pane === "vocabulaire" ? (
        <ul className="catalog">
          {vocab.map((item) => (
            <li key={`${item.source}-${item.term}`}>
              <p className="kicker">{item.source}</p>
              <h2>{item.term}</h2>
              <MarkdownView source={item.text} />
            </li>
          ))}
        </ul>
      ) : null}

      {pane === "lectures" ? (
        <section>
          <p>{library.intro}</p>
          <label className="field inline">
            <span>Rôle</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="tous">Tous</option>
              <option value="primaire">Sources primaires</option>
              <option value="secondaire">Classiques secondaires</option>
              <option value="commentaire">Commentateurs</option>
            </select>
          </label>
          {library.shelves.map((shelf) => {
            const works = shelf.works.filter((work) => role === "tous" || work.role === role).filter((work) => {
              if (!needle) return true;
              return `${work.title} ${work.authors} ${work.cite} ${work.note ?? ""} ${shelf.civilisation}`.toLowerCase().includes(needle);
            });
            if (!works.length) return null;
            return (
              <section key={shelf.id} className="block">
                <h2>{shelf.title}</h2>
                <p className="meta">{shelf.civilisation}</p>
                <ul className="catalog">
                  {works.map((work) => (
                    <li key={`${work.title}-${work.year}`}>
                      <p className="pill">{work.role}</p>
                      <h3>
                        {work.authors}, <em>{work.title}</em>
                        {work.year ? `, ${work.year}` : ""}
                      </h3>
                      <p>{work.cite}</p>
                      {work.note ? <p className="hint">{work.note}</p> : null}
                      {work.reserve ? <p className="reserve">Réserve : {work.reserve}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </section>
      ) : null}
    </article>
  );
}
