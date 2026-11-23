import type React from "react";
import { motionValue } from "motion/react";
import { store } from "../model/store";
import { cardsOf, moveCard as moveCardData } from "../model/ops";
import type { Card } from "../model/types";
import * as a from "../actions";

export const dragX = motionValue(0);
export const dragY = motionValue(0);

let press: { id: string; laneId: string; x: number; y: number; offX: number; offY: number; w: number; h: number } | null = null;
let pointer = { x: 0, y: 0 };
let raf = 0;

export function onCardPointerDown(e: React.PointerEvent<HTMLElement>, card: Card) {
  if (e.button !== 0 || (e.target as HTMLElement).closest("textarea, input, button")) return;
  a.select(card.laneId, card.id);
  const r = e.currentTarget.getBoundingClientRect();
  press = { id: card.id, laneId: card.laneId, x: e.clientX, y: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width, h: r.height };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("keydown", key, true);
}

function hit(x: number, y: number) {
  const lanes = [...document.querySelectorAll<HTMLElement>("[data-lane]")];
  if (!lanes.length || !press) return null;
  let best = lanes[0];
  let bestDist = Infinity;
  for (const el of lanes) {
    const r = el.getBoundingClientRect();
    const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    if (d < bestDist) (bestDist = d), (best = el);
  }
  const cards = [...best.querySelectorAll<HTMLElement>("[data-card]")].filter((el) => el.dataset.card !== press!.id);
  const index = cards.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2 < y;
  }).length;
  return { laneId: best.dataset.lane!, index };
}

function move(e: PointerEvent) {
  if (!press) return;
  pointer = { x: e.clientX, y: e.clientY };
  let drag = store.state.ui.drag;
  if (!drag) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) return;
    const visible = a.visible(press.laneId).filter((c) => c.id !== press!.id);
    const own = a.visible(press.laneId).findIndex((c) => c.id === press!.id);
    drag = { cardId: press.id, laneId: press.laneId, index: Math.min(own, visible.length), width: press.w, height: press.h };
    dragX.set(e.clientX - press.offX);
    dragY.set(e.clientY - press.offY);
    store.setUi({ drag });
    document.body.classList.add("dragging");
    raf = requestAnimationFrame(autoscroll);
  }
  dragX.set(e.clientX - press.offX);
  dragY.set(e.clientY - press.offY);
  const t = hit(e.clientX, e.clientY);
  if (t && (t.laneId !== drag.laneId || t.index !== drag.index)) store.setUi({ drag: { ...drag, ...t } });
}

function autoscroll() {
  const edge = 56;
  const board = document.querySelector<HTMLElement>(".board");
  if (board) {
    const r = board.getBoundingClientRect();
    if (pointer.x < r.left + edge) board.scrollLeft -= 14;
    else if (pointer.x > r.right - edge) board.scrollLeft += 14;
  }
  const lane = store.state.ui.drag && document.querySelector<HTMLElement>(`[data-lane="${store.state.ui.drag.laneId}"] .cards`);
  if (lane) {
    const r = lane.getBoundingClientRect();
    if (pointer.y < r.top + edge) lane.scrollTop -= 12;
    else if (pointer.y > r.bottom - edge) lane.scrollTop += 12;
  }
  raf = requestAnimationFrame(autoscroll);
}

function cleanup() {
  press = null;
  cancelAnimationFrame(raf);
  document.body.classList.remove("dragging");
  window.removeEventListener("pointermove", move);
  window.removeEventListener("pointerup", up);
  window.removeEventListener("keydown", key, true);
}

function up() {
  const drag = store.state.ui.drag;
  cleanup();
  if (!drag) return;
  // The drop index counts visible cards; map it onto the full lane when a search hides some.
  const visible = a.visible(drag.laneId).filter((c) => c.id !== drag.cardId);
  const full = cardsOf(store.state.data, drag.laneId).filter((c) => c.id !== drag.cardId);
  const index =
    drag.index < visible.length ? full.indexOf(visible[drag.index]) : visible.length ? full.indexOf(visible[visible.length - 1]) + 1 : full.length;
  store.commit((d) => moveCardData(d, drag.cardId, drag.laneId, index), { drag: null, laneId: drag.laneId, cardId: drag.cardId });
}


function key(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  e.preventDefault();
  e.stopPropagation();
  const drag = store.state.ui.drag;
  cleanup();
  if (drag) store.setUi({ drag: null });
}
