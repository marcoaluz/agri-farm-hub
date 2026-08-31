/**
 * Registro do Service Worker (PWA) — único ponto de registro do app.
 * Nunca registra em dev, dentro de iframe ou nos previews da Lovable:
 * nesses contextos remove registros antigos para evitar cache velho.
 */
const SW_URL = "/sw-src.js";
const LEGACY_SW_URLS = ["/sw.js", "/push-sw.js"];

let registrationRef: ServiceWorkerRegistration | null = null;
let pendingUpdateCallback: (() => void) | null = null;

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  if (window.self !== window.top) return true;

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;

  return false;
}

async function unregisterAppServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs
      .filter((r) => {
        const url = r.active?.scriptURL || r.waiting?.scriptURL || r.installing?.scriptURL || "";
        return url.endsWith(SW_URL) || LEGACY_SW_URLS.some((legacy) => url.endsWith(legacy));
      })
      .map((r) => r.unregister()),
  );
}

function notifyUpdateAvailable() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sw-update-available"));
}

export function aplicarAtualizacaoPendente() {
  if (typeof window === "undefined") return;

  if (pendingUpdateCallback) {
    pendingUpdateCallback();
    return;
  }

  // Fallback: força recarga com cache limpo se o callback não foi armado.
  window.location.reload();
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (isBlockedContext()) {
    void unregisterAppServiceWorkers();
    return;
  }

  let jaRecarregou = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (jaRecarregou) return;
    jaRecarregou = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    // Limpa registros legados (/sw.js antigo, push-sw.js) e espera terminar
    // antes de registrar o novo — evita os dois brigando pelo mesmo escopo ao mesmo tempo.
    await unregisterAppServiceWorkers();

    navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .then((registration) => {
        registrationRef = registration;

        setInterval(() => {
          void registration.update().catch(() => {});
        }, 5 * 60 * 1000);

        if (registration.waiting) {
          // Nova versão já está esperando — notifica e arma callback.
          pendingUpdateCallback = () => registration.waiting?.postMessage({ type: "SKIP_WAITING" });
          notifyUpdateAvailable();
        }

        registration.addEventListener("updatefound", () => {
          const novoWorker = registration.installing;
          if (!novoWorker) return;

          novoWorker.addEventListener("statechange", () => {
            if (novoWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Atualização baixada e pronta para assumir — notifica e arma callback.
              pendingUpdateCallback = () => novoWorker.postMessage({ type: "SKIP_WAITING" });
              notifyUpdateAvailable();
            }
          });
        });
      })
      .catch(() => {
        /* silencioso: PWA é opcional */
      });
  });
}

