import { useEffect, useState } from "react";
import { Onboarding, onboardingSeen } from "./components/Onboarding";
import { Shell, type PageName } from "./components/Shell";
import { applyTheme, watchSystemTheme } from "./lib/prefs";
import { ReviewProvider, useReviews } from "./state";
import { AujourdHui, LessonReader } from "./views/AujourdHui";
import { Bibliotheque } from "./views/Bibliotheque";
import { Parcours } from "./views/Parcours";
import { Precepteur } from "./views/Precepteur";
import { Reglages } from "./views/Reglages";
import { Revisions } from "./views/Revisions";

const PAGES: PageName[] = ["aujourd-hui", "revisions", "precepteur", "parcours", "bibliotheque", "reglages"];

function parse(hash: string): { page: PageName; thread?: string; lessonId?: string } {
  const parts = hash.replace(/^#/, "").split("/").filter(Boolean);
  if (parts[0] === "lecon" && parts[1]) {
    let lessonId = parts[1];
    try {
      lessonId = decodeURIComponent(parts[1]);
    } catch {
      lessonId = parts[1];
    }
    return { page: "aujourd-hui", lessonId };
  }
  if (parts[0] === "aujourd-hui" && parts[1] === "lire") return { page: "aujourd-hui", lessonId: "@today" };
  const head = parts[0] ?? "aujourd-hui";
  const page = (PAGES.includes(head as PageName) ? head : "aujourd-hui") as PageName;
  const thread = page === "precepteur" && parts[1] ? decodeURIComponent(parts.slice(1).join("/")) : undefined;
  return { page, thread };
}

function Router() {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  const [intro, setIntro] = useState(() => !onboardingSeen());
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
      {intro ? (
        <Onboarding onDone={() => setIntro(false)} />
      ) : null}
      {route.lessonId ? <LessonReader lessonId={route.lessonId} /> : null}
      {route.page === "aujourd-hui" && !route.lessonId ? <AujourdHui /> : null}
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
