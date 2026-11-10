import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "@fontsource/literata/latin-400.css";
import "@fontsource/literata/latin-ext-400.css";
import "@fontsource/literata/latin-400-italic.css";
import "@fontsource/literata/latin-ext-400-italic.css";
import "@fontsource/literata/latin-600.css";
import "@fontsource/literata/latin-ext-600.css";
import "@fontsource/literata/latin-700.css";
import "@fontsource/literata/latin-ext-700.css";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-ext-400.css";
import "@fontsource/source-sans-3/latin-600.css";
import "@fontsource/source-sans-3/latin-ext-600.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Racine absente.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}
