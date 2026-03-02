import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force clear old service worker caches
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

createRoot(document.getElementById("root")!).render(<App />);
