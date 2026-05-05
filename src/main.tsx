import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Remove qualquer PWA/cache antigo para sempre carregar a versão mais recente.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

if ('caches' in window) {
  caches.keys().then((names) => {
    names.forEach((name) => caches.delete(name));
  });
}

// Cache bust: 2026-05-05T2045

createRoot(document.getElementById("root")!).render(<App />);
