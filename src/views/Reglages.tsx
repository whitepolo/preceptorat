import { useRef, useState, type ChangeEvent } from "react";
import { applyProgress, collectProgress, isProgressFile } from "../lib/localProgress";
import { readTheme, writeTheme, type ThemeChoice } from "../lib/prefs";
import { readLocalState } from "../lib/sync";
import { useReviews } from "../state";

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: "system", label: "Système" },
  { id: "light", label: "Clair" },
  { id: "dark", label: "Sombre" },
];

export function Reglages() {
  const { replaceState, pending } = useReviews();
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function chooseTheme(next: ThemeChoice) {
    setTheme(next);
    writeTheme(next);
  }

  function exportProgress() {
    const local = readLocalState().state;
    if (!local) {
      setStatus("Rien à exporter pour l'instant.");
      return;
    }
    const file = collectProgress(local, new Date().toISOString());
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "preceptorat-progression.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Fichier prêt. Garde-le, puis importe-le sur l'autre appareil.");
  }

  function importProgress(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isProgressFile(parsed)) {
          setStatus("Ce fichier ne contient pas une progression Préceptorat.");
          return;
        }
        replaceState(applyProgress(parsed));
        setStatus("Progression importée sur cet appareil.");
      } catch {
        setStatus("Le fichier n'a pas pu être lu.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <article className="sheet">
      <header className="page-head">
        <p className="kicker">Appareil</p>
        <h1>Réglages</h1>
        <p className="lede">Tes réponses et tes notes restent sur cet appareil, même hors ligne. Aucun secret n'est demandé.</p>
      </header>

      <section className="block">
        <h2>Apparence</h2>
        <div className="choices">
          {THEMES.map((item) => (
            <label key={item.id}>
              <input type="radio" name="theme" checked={theme === item.id} onChange={() => chooseTheme(item.id)} />
              {item.label}
            </label>
          ))}
        </div>
      </section>

      <section className="block">
        <h2>Envoyer au précepteur</h2>
        <ol className="steps">
          <li>Termine la leçon, un message, ou une séance de révisions.</li>
          <li>Appuie sur « Envoyer au précepteur ». GitHub s'ouvre, déjà rempli.</li>
          <li>Tu es connecté à GitHub : appuie seulement sur Submit.</li>
        </ol>
        <p className="hint">
          {pending.length === 0
            ? "Aucune révision en attente d'envoi."
            : pending.length === 1
              ? "1 révision pas encore envoyée."
              : `${pending.length} révisions pas encore envoyées.`}
        </p>
      </section>

      <section className="block">
        <h2>Sans GitHub</h2>
        <p>Un fichier JSON suffit pour passer d'un appareil à l'autre.</p>
        <div className="actions">
          <button type="button" className="button primary" onClick={exportProgress}>
            Exporter ma progression
          </button>
          <button type="button" className="button" onClick={() => fileRef.current?.click()}>
            Importer
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importProgress} />
        </div>
      </section>

      {status ? (
        <p className={status.includes("pas") || status.includes("pas pu") ? "hint err" : "hint ok"} role="status">
          {status}
        </p>
      ) : null}
    </article>
  );
}
