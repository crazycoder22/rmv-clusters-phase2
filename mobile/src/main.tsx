import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Browser } from "@capacitor/browser";
import "./index.css";
import App from "./App.tsx";

// Delegate external-link clicks anywhere in the app (e.g. inside rich-text
// announcement bodies) to Capacitor's in-app browser. Plain <a target="_blank">
// clicks don't open anything in a Capacitor WebView by default.
document.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement | null)?.closest?.("a");
  if (!target) return;
  const href = target.getAttribute("href");
  if (!href) return;
  if (!/^https?:\/\//i.test(href)) return;
  e.preventDefault();
  Browser.open({ url: href }).catch(() => window.open(href, "_blank"));
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
