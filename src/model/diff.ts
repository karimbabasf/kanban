import type { Changes, Data, Id } from "./types";

function table<T extends { id: Id }>(prev: Record<Id, T>, next: Record<Id, T>) {
  const upsert: T[] = [];
  const del: Id[] = [];
  if (prev === next) return { upsert, del };
  for (const id in next) if (prev[id] !== next[id]) upsert.push(next[id]);
  for (const id in prev) if (!(id in next)) del.push(id);
  return { upsert, del };
}

/** Rows that differ between two snapshots. Relies on unchanged rows keeping their object identity. */
export function diff(prev: Data, next: Data): Changes {
  const b = table(prev.boards, next.boards);
  const l = table(prev.lanes, next.lanes);
  const c = table(prev.cards, next.cards);
  return {
    upsert: { boards: b.upsert, lanes: l.upsert, cards: c.upsert },
    delete: { boards: b.del, lanes: l.del, cards: c.del },
  };
}

export const isEmpty = (ch: Changes) =>
  !ch.upsert.boards.length && !ch.upsert.lanes.length && !ch.upsert.cards.length &&
  !ch.delete.boards.length && !ch.delete.lanes.length && !ch.delete.cards.length;

export const toData = (rows: { boards: Data["boards"][Id][]; lanes: Data["lanes"][Id][]; cards: Data["cards"][Id][] }): Data => ({
  boards: Object.fromEntries(rows.boards.map((r) => [r.id, r])),
  lanes: Object.fromEntries(rows.lanes.map((r) => [r.id, r])),
  cards: Object.fromEntries(rows.cards.map((r) => [r.id, r])),
});
