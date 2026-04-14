import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force clear old service worker caches - v4
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app");

if ('serviceWorker' in navigator) {
  if (isPreviewHost || isInIframe) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
  caches.keys().then((names) => {
    names.forEach((name) => caches.delete(name));
  });
}
// Cache bust: 2026-04-14T002

createRoot(document.getElementById("root")!).render(<App />);
