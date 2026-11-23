import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Writes dist/sw.js with the hashed file list of this build, so the web app opens offline from the iPhone Home Screen.
 * Pages go network first (a new deploy shows up on the next open); files go cache first (their names change with content).
 */
function offline(): Plugin {
  return {
    name: "kanban-offline",
    apply: "build",
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(
        (f) => /\.(js|css)$/.test(f) || /google-sans-flex-(latin|latin-ext|symbols)-full/.test(f),
      );
      const precache = ["/", "/manifest.webmanifest", "/favicon.svg", "/icons/apple-touch-icon.png", "/icons/icon-192.png", ...files.map((f) => `/${f}`)];
      let h = 0;
      for (const ch of precache.join()) h = (h * 31 + ch.charCodeAt(0)) | 0;
      const source = `const CACHE = "kanban-${(h >>> 0).toString(36)}";
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    const net = fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("/", copy));
      }
      return res;
    });
    const slow = new Promise((r) => setTimeout(r, 3000)).then(() => caches.match("/"));
    e.respondWith(Promise.race([net, slow]).then((res) => res || net).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  plugins: [react(), offline()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  build: { target: "safari16" },
});
