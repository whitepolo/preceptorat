import { useState } from "react";

const KEY = "preceptorat.intro";

export function onboardingSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === "vu";
  } catch {
    return true;
  }
}

export function markOnboardingSeen(): void {
  localStorage.setItem(KEY, "vu");
}

const SCREENS = [
  {
    kicker: "Chaque soir",
    title: "Une leçon, trente à quarante-cinq minutes.",
    text: "Bonsoir Sébastien. Vers 19 h, heure de Maurice, Schopen dépose la leçon du jour. Tu la fais quand tu peux, au calme.",
  },
  {
    kicker: "Avant la solution",
    title: "Écris d'abord. La réponse vient ensuite.",
    text: "Chaque question attend ta tentative, ou un passage explicite. Les révisions du soir mélangent les matières, huit cartes au plus.",
  },
  {
    kicker: "Pour écrire à Schopen",
    title: "Un jeton, une seule fois sur cet appareil.",
    text: "Il reste dans ce navigateur. Il sert à envoyer tes réponses, à parler avec Schopen, et à garder les mêmes révisions sur le téléphone et l'ordinateur.",
  },
];

export function Onboarding({ onDone, onSettings }: { onDone: () => void; onSettings: () => void }) {
  const [index, setIndex] = useState(0);
  const screen = SCREENS[index];
  const last = index === SCREENS.length - 1;

  function finish(toSettings: boolean) {
    markOnboardingSeen();
    onDone();
    if (toSettings) onSettings();
  }

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="onboarding-card">
        <p className="kicker">{screen.kicker}</p>
        <h1 id="intro-title">{screen.title}</h1>
        <p className="lede">{screen.text}</p>
        <div className="dots" aria-hidden="true">
          {SCREENS.map((item, dot) => (
            <span key={item.kicker} className={dot === index ? "on" : ""} />
          ))}
        </div>
        <div className="actions">
          {last ? (
            <>
              <button type="button" className="button primary" onClick={() => finish(true)}>
                Ouvrir les réglages
              </button>
              <button type="button" className="button quiet" onClick={() => finish(false)}>
                Plus tard
              </button>
            </>
          ) : (
            <>
              <button type="button" className="button primary" onClick={() => setIndex((value) => value + 1)}>
                Suivant
              </button>
              <button type="button" className="button quiet" onClick={() => finish(false)}>
                Passer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
