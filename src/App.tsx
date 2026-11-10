import { useEffect, useState } from "react";
import { Shell, type PageName } from "./components/Shell";
import { applyTheme, watchSystemTheme } from "./lib/prefs";
import { ReviewProvider, useReviews } from "./state";
import { AujourdHui } from "./views/AujourdHui";
import { Bibliotheque } from "./views/Bibliotheque";
import { Parcours } from "./views/Parcours";
import { Precepteur } from "./views/Precepteur";
import { Reglages } from "./views/Reglages";
import { Revisions } from "./views/Revisions";

const PAGES: PageName[] = ["aujourd-hui", "revisions", "precepteur", "parcours", "bibliotheque", "reglages"];

function parse(hash: string): { page: PageName; thread?: string } {
  const parts = hash.replace(/^#/, "").split("/").filter(Boolean);
  const head = parts[0] ?? "aujourd-hui";
  const page = (PAGES.includes(head as PageName) ? head : "aujourd-hui") as PageName;
  const thread = page === "precepteur" && parts[1] ? decodeURIComponent(parts.slice(1).join("/")) : undefined;
  return { page, thread };
}

function Router() {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  const { queue, today } = useReviews();

  useEffect(() => {
    applyTheme();
    return watchSystemTheme();
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) window.location.replace("#/aujourd-hui");
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <Shell page={route.page} today={today} due={queue.length}>
      {route.page === "aujourd-hui" ? <AujourdHui /> : null}
      {route.page === "revisions" ? <Revisions /> : null}
      {route.page === "precepteur" ? <Precepteur threadId={route.thread} /> : null}
      {route.page === "parcours" ? <Parcours /> : null}
      {route.page === "bibliotheque" ? <Bibliotheque /> : null}
      {route.page === "reglages" ? <Reglages /> : null}
    </Shell>
  );
}

export function App() {
  return (
    <ReviewProvider>
      <Router />
    </ReviewProvider>
  );
}
