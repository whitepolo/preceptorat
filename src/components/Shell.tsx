import type { ReactNode } from "react";
import { formatLongDate } from "../lib/dates";
import { Icon } from "./Icons";

export type PageName = "aujourd-hui" | "revisions" | "precepteur" | "parcours" | "bibliotheque" | "reglages";

const ITEMS: { id: PageName; label: string; short: string; hash: string; icon: "home" | "cards" | "chat" | "path" | "books" | "settings" }[] = [
  { id: "aujourd-hui", label: "Accueil", short: "Accueil", hash: "#/aujourd-hui", icon: "home" },
  { id: "revisions", label: "Révisions", short: "Révisions", hash: "#/revisions", icon: "cards" },
  { id: "precepteur", label: "Précepteur", short: "Messages", hash: "#/precepteur", icon: "chat" },
  { id: "parcours", label: "Parcours", short: "Parcours", hash: "#/parcours", icon: "path" },
  { id: "bibliotheque", label: "Bibliothèque", short: "Livres", hash: "#/bibliotheque", icon: "books" },
  { id: "reglages", label: "Réglages", short: "Réglages", hash: "#/reglages", icon: "settings" },
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
  const mobile = ITEMS.filter((item) => item.id !== "reglages");
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
        <a className="icon-button" href="#/reglages" aria-label="Réglages" aria-current={page === "reglages" ? "page" : undefined}>
          <Icon name="settings" />
        </a>
      </header>
      <div className="frame">
        <nav className="side" aria-label="Sections">
          {ITEMS.map((item) => (
            <a key={item.id} href={item.hash} aria-current={page === item.id ? "page" : undefined}>
              <Icon name={item.icon} />
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
        {mobile.map((item) => (
          <a key={item.id} href={item.hash} aria-current={page === item.id ? "page" : undefined}>
            <span className="tab-icon">
              <Icon name={item.icon} />
              {item.id === "revisions" && due > 0 ? <span className="badge">{due}</span> : null}
            </span>
            <span>{item.short}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
