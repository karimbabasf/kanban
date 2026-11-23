import { describe, expect, it } from "vitest";
import { cardsOf, createBoard, createCard, deleteBoard, deleteCard, lanesOf, moveCard, moveLane, seed, updateCard } from "./ops";
import { diff, isEmpty } from "./diff";
import { emptyData } from "./types";

const titles = (d: ReturnType<typeof emptyData>, laneId: string) => cardsOf(d, laneId).map((c) => c.title);

function board() {
  const b = createBoard(emptyData(), "B");
  const [a, z] = lanesOf(b.data, b.id);
  let d = b.data;
  for (const t of ["one", "two", "three"]) d = createCard(d, a.id, t).data;
  return { d, a: a.id, z: z.id, boardId: b.id };
}

describe("cards", () => {
  it("moves within a lane and across lanes, keeping positions dense", () => {
    let { d, a, z } = board();
    const three = cardsOf(d, a)[2].id;
    d = moveCard(d, three, a, 0);
    expect(titles(d, a)).toEqual(["three", "one", "two"]);
    d = moveCard(d, three, z, 0);
    expect(titles(d, a)).toEqual(["one", "two"]);
    expect(titles(d, z)).toEqual(["three"]);
    expect(cardsOf(d, a).map((c) => c.position)).toEqual([1, 2]);
  });

  it("returns the same object for a no-op move", () => {
    const { d, a } = board();
    const one = cardsOf(d, a)[0].id;
    expect(moveCard(d, one, a, 0)).toBe(d);
  });

  it("diff only carries rows that changed", () => {
    const { d, a } = board();
    const [one, two] = cardsOf(d, a);
    const next = updateCard(d, two.id, { title: "2" });
    const ch = diff(d, next);
    expect(ch.upsert.cards.map((c) => c.title)).toEqual(["2"]);
    expect(ch.upsert.lanes).toEqual([]);
    const del = deleteCard(next, one.id);
    const ch2 = diff(next, del);
    expect(ch2.delete.cards).toEqual([one.id]);
    expect(isEmpty(diff(del, del))).toBe(true);
  });

  it("deleting a board removes its lanes and cards", () => {
    const { d, boardId } = board();
    const gone = deleteBoard(d, boardId);
    expect(Object.keys(gone.lanes)).toHaveLength(0);
    expect(Object.keys(gone.cards)).toHaveLength(0);
    expect(diff(d, gone).delete.cards).toHaveLength(3);
  });

  it("reorders lanes", () => {
    const { d, boardId } = board();
    const first = lanesOf(d, boardId)[0];
    const moved = moveLane(d, first.id, 1);
    expect(lanesOf(moved, boardId)[1].id).toBe(first.id);
    expect(moveLane(moved, first.id, 5) === moved || lanesOf(moveLane(moved, first.id, 5), boardId).at(-1)!.id === first.id).toBe(true);
  });

  it("seeds one teaching board", () => {
    const d = seed();
    expect(Object.keys(d.boards)).toHaveLength(1);
    expect(Object.keys(d.cards).length).toBeGreaterThan(4);
  });
});
