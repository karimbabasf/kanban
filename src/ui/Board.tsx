import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { Plus } from "lucide-react";
import { store, useStore, type Editing } from "../model/store";
import { lanesOf } from "../model/ops";
import type { Card, Lane } from "../model/types";
import * as a from "../actions";
import { dueLabel } from "../dates";
import { dragX, dragY, onCardPointerDown } from "./drag";

const move = { duration: 0.22, ease: [0.2, 0, 0, 1] } as const;

export function Board() {
  const data = useStore((s) => s.data);
  const ui = useStore((s) => s.ui);
  const boardId = useMemo(() => a.currentBoardId(), [data, ui.boardId]);
  const laneId = useMemo(() => a.currentLaneId(), [data, ui.boardId, ui.laneId]);
  const lanes = useMemo(() => (boardId ? lanesOf(data, boardId) : []), [data.lanes, boardId]);
  // One pass groups every card by lane, so each lane gets a stable array until its cards change.
  const byLane = useMemo(() => {
    const m: Record<string, Card[]> = {};
    for (const c of Object.values(data.cards)) (m[c.laneId] ??= []).push(c);
    for (const k in m) m[k].sort((x, y) => x.position - y.position);
    return m;
  }, [data.cards]);
  const q = ui.search.trim().toLowerCase();
  const anyMatch = !q || lanes.some((l) => (byLane[l.id] ?? NONE).some((c) => a.matches(c, q)));
  const { editing, drag } = ui;

  return (
    <motion.div className="board" layoutScroll key={boardId ?? "none"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
      {lanes.map((l) => {
        const cards = byLane[l.id] ?? NONE;
        const focused = l.id === laneId;
        const editingHere =
          editing &&
          ((editing.kind === "new" && editing.laneId === l.id) ||
            (editing.kind === "lane" && editing.laneId === l.id) ||
            (editing.kind === "title" && data.cards[editing.cardId]?.laneId === l.id))
            ? editing
            : null;
        return (
          <LaneView
            key={l.id}
            lane={l}
            cards={cards}
            q={q}
            focused={focused}
            selId={focused ? ui.cardId : null}
            editing={editingHere}
            dragId={drag?.cardId ?? null}
            slot={drag && drag.laneId === l.id ? drag.index : null}
            slotH={drag?.height ?? 0}
          />
        );
      })}
      {!anyMatch && <p className="no-match">No cards match “{ui.search.trim()}”. Esc clears the search.</p>}
    </motion.div>
  );
}

const NONE: Card[] = [];

interface LaneProps {
  lane: Lane;
  cards: Card[];
  q: string;
  focused: boolean;
  selId: string | null;
  editing: Editing;
  dragId: string | null;
  slot: number | null;
  slotH: number;
}

const LaneView = memo(function LaneView({ lane, cards: all, q, focused, selId, editing, dragId, slot, slotH }: LaneProps) {
  const cards = useMemo(() => all.filter((c) => a.matches(c, q) && c.id !== dragId), [all, q, dragId]);
  const composing = editing?.kind === "new" ? editing.at : null;
  const selectedHere = focused && cards.some((c) => c.id === selId);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the selected card in view while the keyboard walks the lane.
  useEffect(() => {
    if (!focused) return;
    const el = selId ? listRef.current?.querySelector(`[data-card="${selId}"]`) : null;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focused, selId]);

  const items = cards.map((c, i) => (
    <CardView
      key={c.id}
      card={c}
      at={slot !== null && i >= slot ? i + 1 : i}
      selected={c.id === selId && !dragId}
      editing={editing?.kind === "title" && editing.cardId === c.id}
    />
  ));
  if (slot !== null) items.splice(Math.min(slot, items.length), 0, <motion.div key="slot" layout="position" className="slot" style={{ height: slotH }} />);

  return (
    <section className={`lane${focused ? " focused" : ""}`} data-lane={lane.id} aria-label={lane.name}>
      <header className="lane-head" onDoubleClick={() => store.setUi({ editing: { kind: "lane", laneId: lane.id } })}>
        <Count n={q ? cards.length : all.length} />
        {editing?.kind === "lane" ? (
          <input
            className="lane-name editing"
            defaultValue={lane.name}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => a.renameLane(lane.id, e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") store.setUi({ editing: null });
            }}
            aria-label="Lane name"
          />
        ) : (
          <h3 className="lane-name">{lane.name}</h3>
        )}
      </header>
      <motion.div className="cards" ref={listRef} layoutScroll>
        {composing === "top" && <Composer laneId={lane.id} at="top" />}
        <AnimatePresence initial={false} mode="popLayout" custom={store.state.data.cards}>
          {items}
        </AnimatePresence>
        {composing === "bottom" && <Composer laneId={lane.id} at="bottom" />}
        {!composing && (
          <button className={`add-card${focused && !selectedHere && !dragId ? " sel" : ""}`} onClick={() => { a.select(lane.id, null); a.startNewCard("bottom"); }}>
            <Plus size={15} strokeWidth={1.75} aria-hidden />
            Add card
          </button>
        )}
      </motion.div>
    </section>
  );
});

/** Lane count set large in the type; the figure rolls when it changes. */
function Count({ n }: { n: number }) {
  const prev = useRef(n);
  const dir = n >= prev.current ? 1 : -1;
  useEffect(() => void (prev.current = n), [n]);
  return (
    <span className="count" aria-label={`${n} cards`}>
      <AnimatePresence initial={false} mode="popLayout" custom={dir}>
        <motion.span
          key={n}
          custom={dir}
          variants={{ in: (d: number) => ({ y: `${d * 0.5}em`, opacity: 0 }), at: { y: 0, opacity: 1 }, out: (d: number) => ({ y: `${-d * 0.5}em`, opacity: 0 }) }}
          initial="in"
          animate="at"
          exit="out"
          transition={move}
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const fresh = (c: Card) => Date.now() - c.createdAt < 800;

// `at` is the card's visual index: when a drag slot pushes it down, it re-renders and glides.
export const CardView = memo(function CardView({ card, selected, editing }: { card: Card; at: number; selected: boolean; editing: boolean }) {
  // An exiting card lingers while its layout settles; it must not count as a card for drops or selection.
  const present = useIsPresent();
  const due = card.due ? dueLabel(card.due) : null;
  return (
    <motion.article
      layout="position"
      layoutId={card.id}
      data-card={present ? card.id : undefined}
      className={`card${card.label ? ` stock-${card.label}` : ""}${selected ? " sel" : ""}`}
      transition={{ layout: move, default: move }}
      initial={fresh(card) ? { opacity: 0, scale: 0.97 } : false}
      animate={{ opacity: 1, scale: 1 }}
      // Deleted cards fade out; cards that were filtered away or moved to another lane leave at once.
      variants={{ gone: (cards?: Record<string, Card>) => (cards?.[card.id] ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97, transition: { duration: 0.12, ease: "easeOut" } }) }}
      exit="gone"
      onPointerDown={(e) => onCardPointerDown(e, card)}
      onDoubleClick={() => store.setUi({ editing: { kind: "title", cardId: card.id } })}
      aria-selected={present && selected}
    >
      {editing ? <TitleEditor card={card} /> : <p className="title">{card.title}</p>}
      {due && <p className={`due${due.overdue ? " late" : ""}`}>{due.text}</p>}
    </motion.article>
  );
});

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
}

function TitleEditor({ card }: { card: Card }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    autosize(ref.current);
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <textarea
      ref={ref}
      className="title-edit"
      defaultValue={card.title}
      rows={1}
      aria-label="Card title"
      onInput={(e) => autosize(e.currentTarget)}
      onBlur={(e) => a.renameCard(card.id, e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          store.setUi({ editing: null });
        }
      }}
    />
  );
}

function Composer({ laneId, at }: { laneId: string; at: "top" | "bottom" }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const submitted = useRef(false);
  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: "nearest" });
  }, []);
  return (
    <motion.div className="card composer" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.14 }}>
      <textarea
        ref={ref}
        className="title-edit"
        rows={1}
        placeholder="Card title, Enter to add"
        aria-label="New card title"
        onInput={(e) => autosize(e.currentTarget)}
        onBlur={(e) => {
          if (submitted.current) return;
          if (e.currentTarget.value.trim()) a.submitNewCard(laneId, e.currentTarget.value, at);
          a.endComposer();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const keep = a.submitNewCard(laneId, e.currentTarget.value, at);
            if (keep) {
              e.currentTarget.value = "";
              autosize(e.currentTarget);
            } else submitted.current = true;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            submitted.current = true;
            a.endComposer();
          }
        }}
      />
    </motion.div>
  );
}

/** The card under the pointer while dragging. It shares the card's layoutId, so the drop glides into the slot. */
export function DragOverlay() {
  const cardId = useStore((s) => s.ui.drag?.cardId ?? null);
  const width = useStore((s) => s.ui.drag?.width ?? 0);
  const card = useStore((s) => (cardId ? s.data.cards[cardId] : undefined));
  if (!cardId || !card) return null;
  return (
    <motion.div className="drag-layer" style={{ left: dragX, top: dragY, width }}>
      <motion.article layoutId={card.id} className={`card lifted${card.label ? ` stock-${card.label}` : ""}`} initial={false} animate={{ rotate: -1.2, scale: 1.02 }} transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}>
        <p className="title">{card.title}</p>
        {card.due && <p className={`due${dueLabel(card.due).overdue ? " late" : ""}`}>{dueLabel(card.due).text}</p>}
      </motion.article>
    </motion.div>
  );
}
