import { useState, type FormEvent } from "react";
import { REPO } from "../lib/github";
import { testConnection, GithubError } from "../lib/github";
import { readTheme, readToken, writeTheme, writeToken, type ThemeChoice } from "../lib/prefs";

export function Reglages() {
  const [token, setToken] = useState(readToken);
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"idle" | "ok" | "err">("idle");
  const [busy, setBusy] = useState(false);
  const saved = readToken();

  function save(event: FormEvent) {
    event.preventDefault();
    writeToken(token);
    setTone("ok");
    setStatus(token.trim() ? "Jeton enregistré sur cet appareil seulement." : "Jeton effacé de cet appareil.");
  }

  async function check() {
    const current = readToken();
    if (!current) {
      setTone("err");
      setStatus("Enregistre d'abord le jeton, puis appuie sur Tester.");
      return;
    }
    setBusy(true);
    setTone("idle");
    setStatus("Essai de connexion.");
    try {
      const result = await testConnection(current);
      setTone("ok");
      setStatus(`Connexion établie. Compte ${result.login}, dépôt ${result.repo}.`);
    } catch (error) {
      setTone("err");
      setStatus(error instanceof GithubError ? error.message : "La connexion n'a pas abouti.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="sheet">
      <h1>Réglages</h1>
      <p className="lede">Le jeton ne quitte pas ce navigateur. Il n'est pas écrit dans le dépôt.</p>

      <section className="block">
        <h2>Apparence</h2>
        <div className="choices">
          {(
            [
              ["system", "Système"],
              ["light", "Clair"],
              ["dark", "Sombre"],
            ] as const
          ).map(([id, label]) => (
            <label key={id}>
              <input
                type="radio"
                name="theme"
                checked={theme === id}
                onChange={() => {
                  setTheme(id);
                  writeTheme(id);
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="block">
        <h2>Jeton GitHub</h2>
        <ol className="steps">
          <li>Ouvre les jetons fins : github.com/settings/personal-access-tokens/new</li>
          <li>Nomme-le Préceptorat. Choisis comme propriétaire le compte qui peut écrire dans {REPO}.</li>
          <li>Accès au dépôt : seulement preceptorat, pas tous les dépôts.</li>
          <li>Droits du dépôt : Issues, lecture et écriture. Contents, lecture et écriture. Rien d'autre.</li>
          <li>Génère le jeton, copie-le, colle-le ci-dessous. Une seule fois par appareil.</li>
        </ol>
        <p className="hint">
          La lecture des leçons et des fils publics fonctionne sans jeton. Le jeton sert à envoyer tes réponses, à écrire à Schopen, et à synchroniser les révisions entre le téléphone et l'ordinateur. Sans lui, les notes restent dans cet appareil.
        </p>
        <form onSubmit={save}>
          <label className="field">
            <span>Jeton fin</span>
            <input
              type="password"
              autoComplete="off"
              value={token}
              spellCheck={false}
              onChange={(event) => setToken(event.target.value)}
            />
          </label>
          <div className="actions">
            <button type="submit" className="button primary">
              Enregistrer
            </button>
            <button
              type="button"
              className="button quiet"
              onClick={() => {
                setToken("");
                writeToken("");
                setTone("ok");
                setStatus("Jeton effacé de cet appareil.");
              }}
            >
              Effacer
            </button>
            <button type="button" className="button" disabled={busy} onClick={() => void check()}>
              {busy ? "Essai…" : "Tester"}
            </button>
          </div>
        </form>
        <p className="hint">{saved ? `Un jeton est enregistré (fin : ${saved.slice(-4)}).` : "Aucun jeton enregistré."}</p>
        {status ? (
          <p role="status" className={tone === "err" ? "status status-err" : tone === "ok" ? "status status-ok" : "status"}>
            {status}
          </p>
        ) : null}
      </section>
    </article>
  );
}
