export type Id = string;

export const LABELS = ["sun", "sky", "sage", "clay", "lilac"] as const;
export type Label = (typeof LABELS)[number];

export interface Board {
  id: Id;
  name: string;
  position: number;
}

export interface Lane {
  id: Id;
  boardId: Id;
  name: string;
  position: number;
}

export interface Card {
  id: Id;
  laneId: Id;
  title: string;
  notes: string;
  due: string | null; // YYYY-MM-DD, local date
  label: Label | null;
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface Data {
  boards: Record<Id, Board>;
  lanes: Record<Id, Lane>;
  cards: Record<Id, Card>;
}

export interface Rows {
  boards: Board[];
  lanes: Lane[];
  cards: Card[];
}

export interface Changes {
  upsert: Rows;
  delete: { boards: Id[]; lanes: Id[]; cards: Id[] };
}

export const emptyData = (): Data => ({ boards: {}, lanes: {}, cards: {} });
