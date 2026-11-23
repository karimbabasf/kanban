import { store } from "./model/store";
import * as ops from "./model/ops";
import { LABELS, type Card, type Id, type Label } from "./model/types";
import { addDays, today } from "./dates";

const S = () => store.state;

export const query = () => S().ui.search.trim().toLowerCase();
export const matches = (c: Card, q: string) =>
  !q || c.title.toLowerCase().includes(q) || c.notes.toLowerCase().includes(q);

export function currentBoardId(): Id | null {
  const { data, ui } = S();
  if (ui.boardId && data.boards[ui.boardId]) return ui.boardId;
  return ops.boardsOf(data)[0]?.id ?? null;
}
export const lanes = () => {
  const b = currentBoardId();
  return b ? ops.lanesOf(S().data, b) : [];
};
export const visible = (laneId: Id) => {
  const q = query();
  return ops.cardsOf(S().data, laneId).filter((c) => matches(c, q));
};

/** The focused lane, always a lane of the current board when one exists. */
export function currentLaneId(): Id | null {
  const ls = lanes();
  const id = S().ui.laneId;
  return ls.find((l) => l.id === id)?.id ?? ls[0]?.id ?? null;
}

export function currentCard(): Card | null {
  const { data, ui } = S();
  const c = ui.cardId ? data.cards[ui.cardId] : undefined;
  return c && c.laneId === currentLaneId() ? c : null;
}

export function select(laneId: Id | null, cardId: Id | null) {
  const ui = S().ui;
  if (ui.laneId === laneId && ui.cardId === cardId) return;
  store.seal();
  store.setUi({ laneId, cardId });
}

export function selectBoard(id: Id) {
  if (!S().data.boards[id]) return;
  const first = ops.lanesOf(S().data, id)[0];
  const card = first ? ops.cardsOf(S().data, first.id)[0] : undefined;
  store.setUi({ boardId: id, laneId: first?.id ?? null, cardId: card?.id ?? null, search: "", editing: null });
}

export function selectBoardAt(n: number) {
  const b = ops.boardsOf(S().data)[n];
  if (b) selectBoard(b.id);
}

export function stepBoard(delta: number) {
  const bs = ops.boardsOf(S().data);
  const i = bs.findIndex((b) => b.id === currentBoardId());
  const next = bs[Math.max(0, Math.min(bs.length - 1, i + delta))];
  if (next) selectBoard(next.id);
}

type Dir = "up" | "down" | "left" | "right" | "top" | "bottom";

export function moveSelection(dir: Dir) {
  const laneId = currentLaneId();
  if (!laneId) return;
  const cards = visible(laneId);
  const i = cards.findIndex((c) => c.id === currentCard()?.id);
  if (dir === "up" || dir === "down" || dir === "top" || dir === "bottom") {
    if (!cards.length) return;
    const j = dir === "top" ? 0 : dir === "bottom" ? cards.length - 1 : i < 0 ? 0 : i + (dir === "up" ? -1 : 1);
    const c = cards[Math.max(0, Math.min(cards.length - 1, j))];
    select(laneId, c.id);
    return;
  }
  const ls = lanes();
  const li = ls.findIndex((l) => l.id === laneId);
  const target = ls[li + (dir === "left" ? -1 : 1)];
  if (!target) return;
  const tc = visible(target.id);
  const c = tc[Math.min(Math.max(i, 0), tc.length - 1)];
  select(target.id, c?.id ?? null);
}

/** Shift + arrows: carry the selected card. */
export function moveCardBy(dir: Dir) {
  const card = currentCard();
  if (!card) return;
  const { data } = S();
  const own = ops.cardsOf(data, card.laneId);
  const i = own.findIndex((c) => c.id === card.id);
  if (dir === "up" || dir === "down" || dir === "top" || dir === "bottom") {
    const to = dir === "top" ? 0 : dir === "bottom" ? own.length - 1 : i + (dir === "up" ? -1 : 1);
    if (to < 0 || to >= own.length) return;
    store.commit((d) => ops.moveCard(d, card.id, card.laneId, to));
    return;
  }
  const ls = lanes();
  const li = ls.findIndex((l) => l.id === card.laneId);
  const target = ls[li + (dir === "left" ? -1 : 1)];
  if (!target) return;
  const to = Math.min(i, ops.cardsOf(data, target.id).length);
  store.commit((d) => ops.moveCard(d, card.id, target.id, to), { laneId: target.id });
}

export function moveCardTo(cardId: Id, laneId: Id, index: number) {
  store.commit((d) => ops.moveCard(d, cardId, laneId, index), { laneId, cardId });
}

export function moveSelectedToLane(laneId: Id) {
  const card = currentCard();
  if (!card || card.laneId === laneId) return;
  store.commit((d) => ops.moveCard(d, card.id, laneId, ops.cardsOf(d, laneId).length), { laneId });
}

let topIndex = 0;

export function startNewCard(at: "top" | "bottom") {
  const laneId = currentLaneId();
  if (!laneId) return;
  topIndex = 0;
  store.setUi({ editing: { kind: "new", laneId, at }, search: "" });
}

/** Create a card from the composer. Returns true when the composer stays open for the next one. */
export function submitNewCard(laneId: Id, title: string, at: "top" | "bottom"): boolean {
  const t = title.trim();
  if (!t) {
    store.setUi({ editing: null });
    return false;
  }
  // At the top, each new card goes under the one just made, so a typed list keeps its order.
  const index = at === "bottom" ? ops.cardsOf(S().data, laneId).length : topIndex++;
  const r = ops.createCard(S().data, laneId, t, index);
  store.commit(() => r.data, { laneId, cardId: r.id });
  return true;
}

export const endComposer = () => store.setUi({ editing: null });

export function renameCard(id: Id, title: string) {
  const t = title.trim();
  if (t) store.commit((d) => ops.updateCard(d, id, { title: t }), { editing: null });
  else store.setUi({ editing: null });
}

export function editCard(id: Id, patch: ops.CardPatch, key?: string) {
  store.commit((d) => ops.updateCard(d, id, patch), undefined, key);
}

export function deleteSelected() {
  const card = currentCard();
  if (!card) return;
  const cards = visible(card.laneId);
  const i = cards.findIndex((c) => c.id === card.id);
  const next = cards[i + 1] ?? cards[i - 1] ?? null;
  store.commit((d) => ops.deleteCard(d, card.id), { cardId: next?.id ?? null });
}

export function labelSelected(n: number) {
  const card = currentCard();
  if (!card) return;
  const label: Label | null = n === 0 ? null : (LABELS[n - 1] ?? null);
  store.commit((d) => ops.setLabel(d, card.id, card.label === label ? null : label));
}

export function dueSelected(which: "today" | "tomorrow" | "clear") {
  const card = currentCard();
  if (!card) return;
  const due = which === "clear" ? null : which === "today" ? today() : addDays(1);
  store.commit((d) => ops.updateCard(d, card.id, { due }));
}

export function undo() {
  store.undo();
}
export function redo() {
  store.redo();
}

export function newBoard() {
  const r = ops.createBoard(S().data, "Untitled board");
  const first = ops.lanesOf(r.data, r.id)[0];
  store.commit(() => r.data, { boardId: r.id, laneId: first.id, cardId: null, editing: { kind: "board", boardId: r.id }, search: "" });
}

export function renameBoard(id: Id, name: string) {
  const n = name.trim();
  store.commit((d) => (n ? ops.renameBoard(d, id, n) : d), { editing: null });
}

export function deleteCurrentBoard() {
  const id = currentBoardId();
  if (!id) return;
  const bs = ops.boardsOf(S().data);
  const i = bs.findIndex((b) => b.id === id);
  let data = ops.deleteBoard(S().data, id);
  let next = bs[i + 1] ?? bs[i - 1];
  if (!next) {
    const r = ops.createBoard(data, "Board");
    data = r.data;
    next = r.data.boards[r.id];
  }
  const first = ops.lanesOf(data, next.id)[0];
  store.commit(() => data, { boardId: next.id, laneId: first?.id ?? null, cardId: first ? ops.cardsOf(data, first.id)[0]?.id ?? null : null });
}

export function newLane() {
  const b = currentBoardId();
  if (!b) return;
  const ls = lanes();
  const at = ls.findIndex((l) => l.id === currentLaneId()) + 1;
  const r = ops.createLane(S().data, b, "New lane", at || ls.length);
  store.commit(() => r.data, { laneId: r.id, cardId: null, editing: { kind: "lane", laneId: r.id } });
}

export function renameLane(id: Id, name: string) {
  const n = name.trim();
  store.commit((d) => (n ? ops.renameLane(d, id, n) : d), { editing: null });
}

export function deleteCurrentLane() {
  const id = currentLaneId();
  if (!id) return;
  const ls = lanes();
  const i = ls.findIndex((l) => l.id === id);
  const next = ls[i + 1] ?? ls[i - 1] ?? null;
  store.commit((d) => ops.deleteLane(d, id), { laneId: next?.id ?? null, cardId: next ? visible(next.id)[0]?.id ?? null : null });
}

export function moveCurrentLane(delta: number) {
  const id = currentLaneId();
  if (id) store.commit((d) => ops.moveLane(d, id, delta));
}

export const DENSITY_STEP = 0.1;
export function setDensity(v: number) {
  store.setUi({ density: Math.round(Math.max(0, Math.min(1, v)) * 10) / 10 });
}
