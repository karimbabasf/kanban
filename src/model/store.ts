import { useSyncExternalStore } from "react";
import type { Data, Id } from "./types";
import { emptyData } from "./types";

export type Editing =
  | null
  | { kind: "title"; cardId: Id }
  | { kind: "new"; laneId: Id; at: "top" | "bottom" }
  | { kind: "lane"; laneId: Id }
  | { kind: "board"; boardId: Id };

export interface Drag {
  cardId: Id;
  laneId: Id; // lane under the pointer
  index: number; // insert index in that lane, counting without the dragged card
  width: number;
  height: number;
}

export interface Ui {
  boardId: Id | null;
  laneId: Id | null; // focused lane
  cardId: Id | null; // selected card
  editing: Editing;
  search: string;
  palette: boolean;
  help: boolean;
  density: number; // 0..1
  sidebar: boolean;
  inspector: boolean;
  sheet: boolean; // inspector as an overlay on narrow windows
  drawer: boolean; // sidebar as an overlay on narrow windows
  drag: Drag | null;
  saveError: string | null;
}

export interface State {
  ready: boolean;
  data: Data;
  ui: Ui;
}

interface Entry {
  data: Data;
  sel: { boardId: Id | null; laneId: Id | null; cardId: Id | null };
  key?: string;
  at: number;
}

const PREFS = "kanban.prefs.v1";
function loadPrefs(): Partial<Ui> {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) ?? "{}");
    return { density: typeof p.density === "number" ? p.density : undefined, sidebar: p.sidebar, inspector: p.inspector, boardId: p.boardId };
  } catch {
    return {};
  }
}

const baseUi: Ui = {
  boardId: null, laneId: null, cardId: null, editing: null, search: "", palette: false, help: false,
  density: 0.5, sidebar: true, inspector: true, sheet: false, drawer: false, drag: null, saveError: null,
};

const HISTORY = 300;
const COALESCE_MS = 1200;

class Store {
  state: State = { ready: false, data: emptyData(), ui: { ...baseUi } };
  private past: Entry[] = [];
  private future: Entry[] = [];
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = () => this.state;
  private emit() {
    for (const fn of this.listeners) fn();
  }

  init(data: Data) {
    const prefs = loadPrefs();
    const ui: Ui = { ...baseUi };
    for (const [k, v] of Object.entries(prefs)) if (v !== undefined) (ui as unknown as Record<string, unknown>)[k] = v;
    if (!ui.boardId || !data.boards[ui.boardId]) ui.boardId = Object.values(data.boards).sort((x, y) => x.position - y.position)[0]?.id ?? null;
    const lane = Object.values(data.lanes).filter((l) => l.boardId === ui.boardId).sort((x, y) => x.position - y.position)[0];
    ui.laneId = lane?.id ?? null;
    ui.cardId = lane ? Object.values(data.cards).filter((c) => c.laneId === lane.id).sort((x, y) => x.position - y.position)[0]?.id ?? null : null;
    this.state = { ready: true, data, ui };
    this.emit();
  }

  private sel() {
    const { boardId, laneId, cardId } = this.state.ui;
    return { boardId, laneId, cardId };
  }

  /** Apply a data change as one undo step. `key` merges rapid edits of one field into a single step. */
  commit(fn: (d: Data) => Data, ui?: Partial<Ui>, key?: string) {
    const prev = this.state.data;
    const next = fn(prev);
    if (next === prev) {
      if (ui) this.setUi(ui);
      return;
    }
    const now = Date.now();
    const last = this.past[this.past.length - 1];
    if (!(key && last && last.key === key && now - last.at < COALESCE_MS)) {
      this.past.push({ data: prev, sel: this.sel(), key, at: now });
      if (this.past.length > HISTORY) this.past.shift();
    } else {
      last.at = now;
    }
    this.future = [];
    this.state = { ...this.state, data: next, ui: ui ? { ...this.state.ui, ...ui } : this.state.ui };
    this.emit();
  }

  /** Break edit coalescing so the next keyed edit starts a new undo step. */
  seal() {
    const last = this.past[this.past.length - 1];
    if (last) last.key = undefined;
  }

  undo() {
    const e = this.past.pop();
    if (!e) return false;
    this.future.push({ data: this.state.data, sel: this.sel(), at: Date.now() });
    this.restore(e);
    return true;
  }

  redo() {
    const e = this.future.pop();
    if (!e) return false;
    this.past.push({ data: this.state.data, sel: this.sel(), at: Date.now() });
    this.restore(e);
    return true;
  }

  private restore(e: Entry) {
    this.state = { ...this.state, data: e.data, ui: { ...this.state.ui, ...e.sel, editing: null, drag: null } };
    this.emit();
  }

  setUi(patch: Partial<Ui>) {
    this.state = { ...this.state, ui: { ...this.state.ui, ...patch } };
    if ("density" in patch || "sidebar" in patch || "inspector" in patch || "boardId" in patch) {
      const { density, sidebar, inspector, boardId } = this.state.ui;
      try {
        localStorage.setItem(PREFS, JSON.stringify({ density, sidebar, inspector, boardId }));
      } catch {
        /* prefs are a convenience */
      }
    }
    this.emit();
  }

  canUndo = () => this.past.length > 0;
  canRedo = () => this.future.length > 0;
}

export const store = new Store();

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.state));
}
