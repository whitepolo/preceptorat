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
    kicker: "Chaque jour",
    title: "Une leçon, trente à quarante-cinq minutes.",
    text: "Bonjour Sébastien. À partir de 7 h, Schopen dépose la leçon du jour. Tu la fais quand tu peux, au calme.",
  },
  {
    kicker: "Avant la solution",
    title: "Écris d'abord. La réponse vient ensuite.",
    text: "Chaque question attend ta tentative, ou un passage explicite. Les révisions du jour mélangent les matières, huit cartes au plus.",
  },
  {
    kicker: "Pour écrire à Schopen",
    title: "Tes réponses restent ici, puis partent vers GitHub.",
    text: "Tout est enregistré sur l'appareil, même hors ligne. Pour envoyer, ouvre le lien préparé et appuie sur Submit. Téléphone et ordinateur se rejoignent ensuite.",
  },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const screen = SCREENS[index];
  const last = index === SCREENS.length - 1;

  function finish() {
    markOnboardingSeen();
    onDone();
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
              <button type="button" className="button primary" onClick={() => finish()}>
                C'est compris
              </button>
            </>
          ) : (
            <>
              <button type="button" className="button primary" onClick={() => setIndex((value) => value + 1)}>
                Suivant
              </button>
              <button type="button" className="button quiet" onClick={() => finish()}>
                Passer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
