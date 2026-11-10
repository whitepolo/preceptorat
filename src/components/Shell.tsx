import type { ReactNode } from "react";
import { formatLongDate } from "../lib/dates";

export type PageName = "aujourd-hui" | "revisions" | "precepteur" | "parcours" | "bibliotheque" | "reglages";

const ITEMS: { id: PageName; label: string; hash: string }[] = [
  { id: "aujourd-hui", label: "Aujourd'hui", hash: "#/aujourd-hui" },
  { id: "revisions", label: "Révisions", hash: "#/revisions" },
  { id: "precepteur", label: "Précepteur", hash: "#/precepteur" },
  { id: "parcours", label: "Parcours", hash: "#/parcours" },
  { id: "bibliotheque", label: "Bibliothèque", hash: "#/bibliotheque" },
  { id: "reglages", label: "Réglages", hash: "#/reglages" },
];

export function Shell({
  page,
  today,
  due,
  children,
}: {
  page: PageName;
  today: string;
  due: number;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <a
        className="skip"
        href="#contenu"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("contenu")?.focus();
        }}
      >
        Aller au contenu
      </a>
      <header className="top">
        <div>
          <p className="brand">Préceptorat</p>
          <p className="date">{formatLongDate(today)}</p>
        </div>
        <a className="text-link" href="#/reglages">
          Réglages
        </a>
      </header>
      <div className="frame">
        <nav className="side" aria-label="Sections">
          {ITEMS.map((item) => (
            <a key={item.id} href={item.hash} aria-current={page === item.id ? "page" : undefined}>
              <span>{item.label}</span>
              {item.id === "revisions" && due > 0 ? <span className="badge">{due}</span> : null}
            </a>
          ))}
        </nav>
        <main id="contenu" tabIndex={-1}>
          {children}
        </main>
      </div>
      <nav className="tabbar" aria-label="Sections">
        {ITEMS.filter((item) => item.id !== "reglages").map((item) => (
          <a key={item.id} href={item.hash} aria-current={page === item.id ? "page" : undefined}>
            <span>{item.label === "Aujourd'hui" ? "Ce soir" : item.label}</span>
            {item.id === "revisions" && due > 0 ? <span className="badge">{due}</span> : null}
          </a>
        ))}
      </nav>
    </div>
  );
}
