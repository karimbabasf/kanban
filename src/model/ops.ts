import type { Board, Card, Data, Id, Label, Lane } from "./types";

export const newId = (): Id => crypto.randomUUID();
const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export const boardsOf = (d: Data): Board[] => Object.values(d.boards).sort(byPos);
export const lanesOf = (d: Data, boardId: Id): Lane[] =>
  Object.values(d.lanes).filter((l) => l.boardId === boardId).sort(byPos);
export const cardsOf = (d: Data, laneId: Id): Card[] =>
  Object.values(d.cards).filter((c) => c.laneId === laneId).sort(byPos);
export const cardCount = (d: Data, boardId: Id): number => {
  const lanes = new Set(lanesOf(d, boardId).map((l) => l.id));
  let n = 0;
  for (const c of Object.values(d.cards)) if (lanes.has(c.laneId)) n++;
  return n;
};

/** Give the ordered items positions 1..n, keeping the object for any item whose position is unchanged. */
function renumber<T extends { id: Id; position: number }>(table: Record<Id, T>, ordered: T[]): Record<Id, T> {
  let out = table;
  ordered.forEach((item, i) => {
    const position = i + 1;
    const current = out[item.id] ?? item;
    if (current.position !== position || out[item.id] !== current) {
      if (out === table) out = { ...table };
      out[item.id] = current.position === position ? current : { ...current, position };
    }
  });
  return out;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function createBoard(d: Data, name: string, laneNames = ["To do", "Doing", "Done"]): { data: Data; id: Id } {
  const id = newId();
  const position = boardsOf(d).reduce((m, b) => Math.max(m, b.position), 0) + 1;
  const lanes = { ...d.lanes };
  laneNames.forEach((n, i) => {
    const lid = newId();
    lanes[lid] = { id: lid, boardId: id, name: n, position: i + 1 };
  });
  return { data: { ...d, boards: { ...d.boards, [id]: { id, name, position } }, lanes }, id };
}

export function renameBoard(d: Data, id: Id, name: string): Data {
  const b = d.boards[id];
  if (!b || b.name === name) return d;
  return { ...d, boards: { ...d.boards, [id]: { ...b, name } } };
}

export function deleteBoard(d: Data, id: Id): Data {
  if (!d.boards[id]) return d;
  const laneIds = new Set(lanesOf(d, id).map((l) => l.id));
  const boards = { ...d.boards };
  delete boards[id];
  const lanes = Object.fromEntries(Object.entries(d.lanes).filter(([, l]) => !laneIds.has(l.id)));
  const cards = Object.fromEntries(Object.entries(d.cards).filter(([, c]) => !laneIds.has(c.laneId)));
  return { boards, lanes, cards };
}

export function createLane(d: Data, boardId: Id, name: string, index?: number): { data: Data; id: Id } {
  const id = newId();
  const ordered = lanesOf(d, boardId);
  const lane: Lane = { id, boardId, name, position: 0 };
  ordered.splice(clamp(index ?? ordered.length, 0, ordered.length), 0, lane);
  return { data: { ...d, lanes: renumber({ ...d.lanes, [id]: lane }, ordered) }, id };
}

export function renameLane(d: Data, id: Id, name: string): Data {
  const l = d.lanes[id];
  if (!l || l.name === name) return d;
  return { ...d, lanes: { ...d.lanes, [id]: { ...l, name } } };
}

export function deleteLane(d: Data, id: Id): Data {
  const l = d.lanes[id];
  if (!l) return d;
  const lanes = { ...d.lanes };
  delete lanes[id];
  const cards = Object.fromEntries(Object.entries(d.cards).filter(([, c]) => c.laneId !== id));
  const next = { ...d, lanes, cards };
  return { ...next, lanes: renumber(lanes, lanesOf(next, l.boardId)) };
}

export function moveLane(d: Data, id: Id, delta: number): Data {
  const l = d.lanes[id];
  if (!l) return d;
  const ordered = lanesOf(d, l.boardId);
  const from = ordered.findIndex((x) => x.id === id);
  const to = clamp(from + delta, 0, ordered.length - 1);
  if (from === to) return d;
  ordered.splice(to, 0, ...ordered.splice(from, 1));
  return { ...d, lanes: renumber(d.lanes, ordered) };
}

export function createCard(d: Data, laneId: Id, title: string, index?: number, now = Date.now()): { data: Data; id: Id } {
  const id = newId();
  const card: Card = { id, laneId, title, notes: "", due: null, label: null, position: 0, createdAt: now, updatedAt: now };
  const ordered = cardsOf(d, laneId);
  ordered.splice(clamp(index ?? ordered.length, 0, ordered.length), 0, card);
  return { data: { ...d, cards: renumber({ ...d.cards, [id]: card }, ordered) }, id };
}

export type CardPatch = Partial<Pick<Card, "title" | "notes" | "due" | "label">>;

export function updateCard(d: Data, id: Id, patch: CardPatch, now = Date.now()): Data {
  const c = d.cards[id];
  if (!c) return d;
  const changed = (Object.keys(patch) as (keyof CardPatch)[]).some((k) => patch[k] !== c[k]);
  if (!changed) return d;
  return { ...d, cards: { ...d.cards, [id]: { ...c, ...patch, updatedAt: now } } };
}

export const setLabel = (d: Data, id: Id, label: Label | null) => updateCard(d, id, { label });

export function deleteCard(d: Data, id: Id): Data {
  const c = d.cards[id];
  if (!c) return d;
  const cards = { ...d.cards };
  delete cards[id];
  const next = { ...d, cards };
  return { ...next, cards: renumber(cards, cardsOf(next, c.laneId)) };
}

/** Move a card to `index` in `laneId` (index counts the lane's cards without the moving card). */
export function moveCard(d: Data, id: Id, laneId: Id, index: number): Data {
  const c = d.cards[id];
  if (!c || !d.lanes[laneId]) return d;
  const source = cardsOf(d, c.laneId).filter((x) => x.id !== id);
  const target = laneId === c.laneId ? source : cardsOf(d, laneId);
  const to = clamp(index, 0, target.length);
  if (laneId === c.laneId && cardsOf(d, laneId).findIndex((x) => x.id === id) === to) return d;
  const moved: Card = { ...c, laneId };
  target.splice(to, 0, moved);
  let cards = { ...d.cards, [id]: moved };
  if (laneId !== c.laneId) cards = renumber(cards, source);
  cards = renumber(cards, target);
  return { ...d, cards };
}

export function seed(now = Date.now(), touch = false): Data {
  const { data, id } = createBoard({ boards: {}, lanes: {}, cards: {} }, "Start here");
  const [todo, doing, done] = lanesOf(data, id);
  let d = data;
  const add = (laneId: Id, title: string, notes = "", label: Label | null = null) => {
    const r = createCard(d, laneId, title, undefined, now);
    d = updateCard(r.data, r.id, { notes, label }, now);
  };
  if (touch) {
    add(todo.id, "Type below to add a card", "Press return to add it. The field stays open, so you can add a whole list in one go.");
    add(todo.id, "Swipe a card right to move it", "It goes to the bottom of the next lane.");
    add(todo.id, "Swipe a card left to delete it", "Undo brings it back.", "clay");
    add(todo.id, "Tap a card to open it", "Notes, a due date, a color and the lane all live here.", "sun");
    add(doing.id, "Swipe the board sideways to change lanes", "Or tap a lane at the top.", "sky");
    add(done.id, "Everything saves on this phone", "Nothing leaves the device. To keep it like an app, tap Share, then Add to Home Screen.", "sage");
    return d;
  }
  add(todo.id, "Press N to add a card", "Type a title and press Enter. The next empty card opens right away, so you can dump a list fast. Esc stops.");
  add(todo.id, "Shift + arrows move a card", "Shift + Left and Right jump lanes. Shift + Up and Down reorder. H J K L work in place of the arrows.");
  add(todo.id, "Press 1 to 5 to color a card", "0 clears the color.", "sun");
  add(todo.id, "Cmd K finds any command", "Boards, lanes, cards, and every action live there.");
  add(doing.id, "Arrows or H J K L move the selection", "Enter renames the card. E jumps to these notes. Esc comes back to the board.", "sky");
  add(done.id, "Every change is saved to disk", "Cmd Z undoes anything, deletes included. Delete this board from Cmd K when you are done with it.", "sage");
  return d;
}
