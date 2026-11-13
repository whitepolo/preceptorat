export type ThemeChoice = "system" | "light" | "dark";

const THEME_KEY = "preceptorat.theme";

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    /* private mode */
  }
  return "system";
}

export function writeTheme(theme: ThemeChoice): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  emit();
}

export function applyTheme(theme: ThemeChoice = readTheme()): void {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themeChoice = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#131210" : "#efeae1");
}

export function watchSystemTheme(): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readTheme() === "system") applyTheme("system");
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
