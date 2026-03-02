import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force clear old service worker caches - v2
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
  caches.keys().then((cacheNames) => {
    cacheNames.forEach((cacheName) => {
      caches.delete(cacheName);
    });
  });
}
// Cache bust: 2026-03-02T001

createRoot(document.getElementById("root")!).render(<App />);
