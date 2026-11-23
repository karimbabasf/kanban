import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { store } from "../model/store";
import { boardsOf, lanesOf } from "../model/ops";
import { LABELS } from "../model/types";
import * as a from "../actions";
import { openDue, openNotes } from "../keys";
import { Keys } from "./Key";

interface Cmd {
  id: string;
  label: string;
  group: string;
  keys?: string[];
  run: () => void;
}

const COLOR_NAMES: Record<string, string> = { sun: "yellow", sky: "blue", sage: "green", clay: "orange", lilac: "purple" };

function commands(): Cmd[] {
  const { data } = store.state;
  const card = a.currentCard();
  const boardId = a.currentBoardId();
  const out: Cmd[] = [];
  const add = (group: string, label: string, run: () => void, keys?: string[]) => out.push({ id: `${group}:${label}`, group, label, run, keys });

  add("Card", "New card", () => a.startNewCard("bottom"), ["N"]);
  add("Card", "New card at the top", () => a.startNewCard("top"), ["⇧", "N"]);
  if (card) {
    add("Card", "Rename card", () => store.setUi({ editing: { kind: "title", cardId: card.id } }), ["↵"]);
    add("Card", "Edit notes", openNotes, ["E"]);
    add("Card", "Due today", () => a.dueSelected("today"), ["T"]);
    add("Card", "Due tomorrow", () => a.dueSelected("tomorrow"));
    add("Card", "Pick a due date", openDue, ["D"]);
    if (card.due) add("Card", "Clear due date", () => a.dueSelected("clear"), ["⇧", "T"]);
    LABELS.forEach((l, i) => add("Card", `Color ${COLOR_NAMES[l]}`, () => a.labelSelected(i + 1), [String(i + 1)]));
    if (card.label) add("Card", "Clear color", () => a.labelSelected(0), ["0"]);
    for (const l of boardId ? lanesOf(data, boardId) : []) if (l.id !== card.laneId) add("Card", `Move card to ${l.name}`, () => a.moveSelectedToLane(l.id));
    add("Card", "Delete card", a.deleteSelected, ["⌫"]);
  }
  add("Lane", "New lane", a.newLane);
  const laneId = a.currentLaneId();
  if (laneId) {
    add("Lane", "Rename lane", () => store.setUi({ editing: { kind: "lane", laneId } }));
    add("Lane", "Move lane left", () => a.moveCurrentLane(-1));
    add("Lane", "Move lane right", () => a.moveCurrentLane(1));
    add("Lane", "Delete lane and its cards", a.deleteCurrentLane);
  }
  add("Board", "New board", a.newBoard, ["⌘", "N"]);
  if (boardId) {
    add("Board", "Rename board", () => store.setUi({ editing: { kind: "board", boardId } }));
    add("Board", "Delete board", a.deleteCurrentBoard);
  }
  boardsOf(data).forEach((b, i) => b.id !== boardId && add("Go", `Go to ${b.name}`, () => a.selectBoard(b.id), i < 9 ? ["⌘", String(i + 1)] : undefined));
  add("View", "Undo", a.undo, ["⌘", "Z"]);
  add("View", "Redo", a.redo, ["⇧", "⌘", "Z"]);
  add("View", "Search this board", () => requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".search input")?.focus()), ["/"]);
  add("View", "Denser", () => a.setDensity(store.state.ui.density - a.DENSITY_STEP), ["⌘", "-"]);
  add("View", "Roomier", () => a.setDensity(store.state.ui.density + a.DENSITY_STEP), ["⌘", "="]);
  add("View", "Show or hide the sidebar", () => store.setUi({ sidebar: !store.state.ui.sidebar, drawer: !store.state.ui.drawer }), ["⌘", "\\"]);
  add("View", "Show or hide the inspector", () => store.setUi({ inspector: !store.state.ui.inspector, sheet: !store.state.ui.sheet }), ["⌘", "I"]);
  add("View", "Keyboard shortcuts", () => store.setUi({ help: true }), ["?"]);
  return out;
}

function cardHits(q: string): Cmd[] {
  if (!q) return [];
  const { data } = store.state;
  const hits: Cmd[] = [];
  for (const c of Object.values(data.cards)) {
    if (!c.title.toLowerCase().includes(q)) continue;
    const lane = data.lanes[c.laneId];
    const board = lane && data.boards[lane.boardId];
    if (!board) continue;
    hits.push({
      id: `card:${c.id}`,
      group: "Cards",
      label: `${c.title}  ·  ${board.name} / ${lane.name}`,
      run: () => store.setUi({ boardId: board.id, laneId: lane.id, cardId: c.id, search: "" }),
    });
    if (hits.length >= 8) break;
  }
  return hits;
}

const score = (label: string, words: string[]) => words.every((w) => label.toLowerCase().includes(w));

export function Palette() {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const all = useMemo(commands, []);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = [...all.filter((c) => score(c.label, words)), ...cardHits(q.trim().toLowerCase())];
  const listRef = useRef<HTMLUListElement>(null);
  const close = () => store.setUi({ palette: false });
  const run = (c: Cmd | undefined) => {
    if (!c) return;
    close();
    requestAnimationFrame(c.run);
  };

  useEffect(() => setI(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: "nearest" });
  }, [i]);

  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }} onClick={close}>
      <motion.div
        className="dialog palette"
        role="dialog"
        aria-label="Commands"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.14 } }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          placeholder="Type a command or a card"
          aria-label="Command"
          onChange={(e) => setQ(e.currentTarget.value)}
          onKeyDown={(e) => {
            const down = e.key === "ArrowDown" || (e.ctrlKey && e.key === "n");
            const up = e.key === "ArrowUp" || (e.ctrlKey && e.key === "p");
            if (down || up) {
              e.preventDefault();
              setI((x) => (list.length ? (x + (down ? 1 : -1) + list.length) % list.length : 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(list[i]);
            } else if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
              e.preventDefault();
              close();
            }
          }}
        />
        <ul ref={listRef} role="listbox">
          {list.map((c, n) => (
            <li key={c.id} data-i={n} role="option" aria-selected={n === i} className={`${n === i ? "on" : ""}${n === 0 || list[n - 1].group !== c.group ? " first" : ""}`} onPointerMove={() => setI(n)} onClick={() => run(c)}>
              <span className="grp">{c.group}</span>
              <span className="lbl">{c.label}</span>
              {c.keys && <Keys keys={c.keys} />}
            </li>
          ))}
          {!list.length && <li className="none">Nothing matches. Esc closes.</li>}
        </ul>
      </motion.div>
    </motion.div>
  );
}
