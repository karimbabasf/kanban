import type { Changes, Data, Rows } from "./types";
import { diff, isEmpty, toData } from "./diff";
import { store } from "./store";

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface Backend {
  load(): Promise<Data | null>;
  apply(ch: Changes): Promise<void>;
}

const tauriBackend: Backend = {
  async load() {
    const { invoke } = await import("@tauri-apps/api/core");
    const rows = await invoke<Rows>("load_data");
    return rows.boards.length ? toData(rows) : null;
  },
  async apply(changes) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("apply_changes", { changes });
  },
};

// Browser build: development and screenshots only.
const KEY = "kanban.data.v1";
const browserBackend: Backend = {
  async load() {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Data) : null;
  },
  async apply() {
    localStorage.setItem(KEY, JSON.stringify(store.state.data));
  },
};

const backend = inTauri ? tauriBackend : browserBackend;

let saved: Data | null = null;
let inflight: Promise<void> | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;

/** Write every change since the last successful save. Calls coalesce while a write is in flight. */
function flush(): Promise<void> {
  if (inflight) return inflight;
  if (!saved) return Promise.resolve();
  const target = store.state.data;
  const ch = diff(saved, target);
  if (isEmpty(ch)) return Promise.resolve();
  inflight = backend
    .apply(ch)
    .then(() => {
      saved = target;
      if (store.state.ui.saveError) store.setUi({ saveError: null });
    })
    .catch((err) => {
      store.setUi({ saveError: String(err?.message ?? err) });
      if (!retry) retry = setTimeout(() => ((retry = null), flush()), 1500);
    })
    .finally(() => {
      inflight = null;
      if (saved === target && store.state.data !== target) void flush();
    });
  return inflight;
}

export async function flushAll() {
  for (let i = 0; i < 5 && saved && store.state.data !== saved; i++) await flush();
}

export async function boot(seed: () => Data) {
  let data = await backend.load();
  let fresh = false;
  if (!data) {
    data = seed();
    fresh = true;
  }
  saved = fresh ? { boards: {}, lanes: {}, cards: {} } : data;
  store.init(data);
  store.subscribe(() => {
    if (store.state.data !== saved) queueMicrotask(flush);
  });
  if (fresh) await flush();
  if (inTauri) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().onCloseRequested(async () => {
      await flushAll();
    });
    const { listen } = await import("@tauri-apps/api/event");
    await listen<string>("menu", (e) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (typing) document.execCommand(e.payload);
      else if (e.payload === "undo") store.undo();
      else if (e.payload === "redo") store.redo();
    });
  }
}
