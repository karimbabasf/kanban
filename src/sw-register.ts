const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Web build only: cache the app so it opens offline from the Home Screen, and ask the browser to keep its data. */
export function registerWorker() {
  if (!import.meta.env.PROD || inTauri || !("serviceWorker" in navigator)) return;
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* the app works without the cache, only not offline */
    });
  });
  navigator.storage?.persist?.().catch(() => {});
}
