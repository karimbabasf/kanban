import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { ArrowRight, ArrowUp, Menu, Plus, Trash2 } from "lucide-react";
import { store, useStore } from "../model/store";
import * as ops from "../model/ops";
import * as a from "../actions";
import { dueLabel } from "../dates";
import type { Card, Id, Lane } from "../model/types";
import { Inspector } from "./Inspector";

// Same curve and durations as the Mac layout: 0.12 feedback, 0.22 moves, 0.32 panes.
const EASE = [0.2, 0, 0, 1] as const;
const MOVE = { duration: 0.22, ease: EASE } as const;
const PANE = { duration: 0.32, ease: EASE } as const;
const OUT = { duration: 0.16, ease: EASE } as const;

type Toast = { id: number; text: string } | null;

/** Size the app to the visible part of the screen, so the capture bar rides on top of the iOS keyboard. */
function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;
    const on = () => {
      root.style.setProperty("--vv-h", `${vv.height}px`);
      root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
      root.toggleAttribute("data-kb", innerHeight - vv.height > 120);
    };
    on();
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => {
      vv.removeEventListener("resize", on);
      vv.removeEventListener("scroll", on);
      root.style.removeProperty("--vv-h");
      root.style.removeProperty("--vv-top");
      root.removeAttribute("data-kb");
    };
  }, []);
}

export function PhoneApp() {
  const data = useStore((s) => s.data);
  const ui = useStore((s) => s.ui);
  const boardId = useMemo(() => a.currentBoardId(), [data, ui.boardId]);
  const lanes = useMemo(() => (boardId ? ops.lanesOf(data, boardId) : []), [data, boardId]);
  const laneId = useMemo(() => a.currentLaneId(), [data, ui.boardId, ui.laneId]);
  const index = Math.max(0, lanes.findIndex((l) => l.id === laneId));
  const byLane = useMemo(() => {
    const m: Record<Id, Card[]> = {};
    for (const l of lanes) m[l.id] = ops.cardsOf(data, l.id);
    return m;
  }, [data, lanes]);

  const [toast, setToast] = useState<Toast>(null);
  const say = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  useVisualViewport();

  // The pager is a native scroll-snap strip; a motion value carries its position (in lanes) to the tab marker.
  const pager = useRef<HTMLDivElement>(null);
  const progress = useMotionValue(index);
  const lanesRef = useRef(lanes);
  lanesRef.current = lanes;
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastBoard = useRef(boardId);

  const onScroll = () => {
    const el = pager.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    progress.set(el.scrollLeft / w);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const lane = lanesRef.current[Math.round(el.scrollLeft / w)];
      if (lane && lane.id !== store.state.ui.laneId) store.setUi({ laneId: lane.id, cardId: null });
    }, 90);
  };

  // Follow the selected lane when it changes from outside the pager: a tab, undo, a board switch, the sheet.
  useLayoutEffect(() => {
    const el = pager.current;
    if (!el) return;
    const jump = lastBoard.current !== boardId;
    lastBoard.current = boardId;
    const left = index * el.clientWidth;
    if (Math.abs(el.scrollLeft - left) < 2) return;
    el.scrollTo({ left, behavior: jump ? "instant" : "smooth" });
    if (jump) progress.set(index);
  }, [index, boardId, progress]);

  useEffect(() => {
    const on = () => {
      const el = pager.current;
      if (!el) return;
      el.scrollTo({ left: index * el.clientWidth, behavior: "instant" });
      progress.set(index);
    };
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, [index, progress]);

  const open = useCallback((card: Card) => {
    a.select(card.laneId, card.id);
    store.setUi({ sheet: true });
  }, []);

  const moveOn = useCallback(
    (card: Card, to: Lane) => {
      store.commit((d) => ops.moveCard(d, card.id, to.id, ops.cardsOf(d, to.id).length), { cardId: null });
      say(`Moved to ${to.name}`);
    },
    [say],
  );

  const remove = useCallback(
    (card: Card) => {
      store.commit((d) => ops.deleteCard(d, card.id), { cardId: null });
      say("Deleted");
    },
    [say],
  );

  const added = () =>
    requestAnimationFrame(() => {
      const lane = pager.current?.children[index]?.querySelector(".ph-lane");
      lane?.scrollTo({ top: lane.scrollHeight, behavior: "smooth" });
    });

  const board = boardId ? data.boards[boardId] : undefined;
  const lane = lanes[index];

  return (
    <div className="phone">
      <header className="ph-top">
        <div className="ph-bar">
          <button className="ph-icon" aria-label="Boards and lanes" onClick={() => store.setUi({ drawer: true })}>
            <Menu size={22} strokeWidth={1.75} />
          </button>
          {board && <BoardTitle id={board.id} name={board.name} editing={ui.editing?.kind === "board" && ui.editing.boardId === board.id} />}
        </div>
        <Tabs lanes={lanes} counts={byLane} index={index} progress={progress} />
      </header>

      <div className="ph-pager" ref={pager} onScroll={onScroll}>
        {lanes.map((l, i) => (
          <LanePage key={l.id} lane={l} cards={byLane[l.id] ?? []} next={lanes[i + 1]} onOpen={open} onMove={moveOn} onDelete={remove} />
        ))}
      </div>

      <ToastView toast={toast} onDone={() => setToast(null)} />
      <Capture lane={lane} onAdded={added} />

      <AnimatePresence>{ui.drawer && <Drawer key="drawer" boardId={boardId} lanes={lanes} counts={byLane} say={say} />}</AnimatePresence>
      <AnimatePresence>{ui.sheet && ui.cardId && <Sheet key="sheet" cardId={ui.cardId} say={say} />}</AnimatePresence>
    </div>
  );
}

function BoardTitle({ id, name, editing }: { id: Id; name: string; editing: boolean }) {
  if (editing) {
    return (
      <input
        className="ph-title"
        defaultValue={name === "Untitled board" ? "" : name}
        placeholder="Board name"
        aria-label="Board name"
        autoFocus
        enterKeyHint="done"
        onBlur={(e) => a.renameBoard(id, e.currentTarget.value || name)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
    );
  }
  return (
    <button className="ph-title" onClick={() => store.setUi({ editing: { kind: "board", boardId: id } })} aria-label={`${name}, rename`}>
      {name}
    </button>
  );
}

function Tabs({ lanes, counts, index, progress }: { lanes: Lane[]; counts: Record<Id, Card[]>; index: number; progress: MotionValue<number> }) {
  const row = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);

  // The marker sits under the lane in view and slides with the finger while the board is swiped.
  const place = useCallback((p: number) => {
    const tabs = row.current?.querySelectorAll<HTMLElement>(".ph-tab");
    const m = mark.current;
    if (!tabs?.length || !m) return;
    const i = Math.max(0, Math.min(tabs.length - 1, Math.floor(p)));
    const f = Math.max(0, Math.min(1, p - i));
    const A = tabs[i];
    const B = tabs[Math.min(tabs.length - 1, i + 1)];
    const inset = 10;
    const left = A.offsetLeft + (B.offsetLeft - A.offsetLeft) * f + inset;
    const width = A.offsetWidth + (B.offsetWidth - A.offsetWidth) * f - inset * 2;
    m.style.transform = `translateX(${left}px)`;
    m.style.width = `${Math.max(0, width)}px`;
  }, []);

  useLayoutEffect(() => place(progress.get()), [lanes, counts, place, progress]);
  useEffect(() => progress.on("change", place), [progress, place]);
  useEffect(() => {
    const tab = row.current?.querySelectorAll<HTMLElement>(".ph-tab")[index];
    tab?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [index]);

  return (
    <div className="ph-tabs" ref={row} role="tablist" aria-label="Lanes">
      {lanes.map((l, i) => (
        <button
          key={l.id}
          role="tab"
          aria-selected={i === index}
          className={`ph-tab${i === index ? " on" : ""}`}
          onClick={() => store.setUi({ laneId: l.id, cardId: null })}
        >
          <span className="n">{counts[l.id]?.length ?? 0}</span>
          <span className="nm">{l.name}</span>
        </button>
      ))}
      <div className="ph-mark" ref={mark} aria-hidden />
    </div>
  );
}

function LanePage({ lane, cards, next, onOpen, onMove, onDelete }: {
  lane: Lane;
  cards: Card[];
  next: Lane | undefined;
  onOpen: (c: Card) => void;
  onMove: (c: Card, to: Lane) => void;
  onDelete: (c: Card) => void;
}) {
  return (
    <section className="ph-page" aria-label={lane.name}>
      <div className="ph-lane">
        <AnimatePresence initial={false}>
          {cards.map((c) => (
            <motion.div
              key={c.id}
              className="ph-item"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: MOVE }}
              transition={MOVE}
            >
              <SwipeCard card={c} next={next} onOpen={onOpen} onMove={onMove} onDelete={onDelete} />
            </motion.div>
          ))}
        </AnimatePresence>
        {cards.length === 0 && <p className="ph-empty">Nothing in {lane.name}. Type below to add a card.</p>}
      </div>
    </section>
  );
}

function SwipeCard({ card, next, onOpen, onMove, onDelete }: {
  card: Card;
  next: Lane | undefined;
  onOpen: (c: Card) => void;
  onMove: (c: Card, to: Lane) => void;
  onDelete: (c: Card) => void;
}) {
  const x = useMotionValue(0);
  const showMove = useTransform(x, [0, 28], [0, 1]);
  const showDelete = useTransform(x, [-28, 0], [1, 0]);
  const [armed, setArmed] = useState<-1 | 0 | 1>(0);
  const armedRef = useRef<-1 | 0 | 1>(0);
  const gesture = useRef<{ id: number; x0: number; y0: number; w: number; on: boolean; lx: number; lt: number; v: number } | null>(null);
  const swiped = useRef(false);
  const due = card.due ? dueLabel(card.due) : null;

  const arm = (v: -1 | 0 | 1) => {
    if (armedRef.current === v) return;
    armedRef.current = v;
    setArmed(v);
  };

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const w = e.currentTarget.getBoundingClientRect().width;
    gesture.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, w, on: false, lx: e.clientX, lt: e.timeStamp, v: 0 };
  };

  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.on) {
      // Vertical drags scroll the lane; a mostly sideways drag picks up the card.
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return void (gesture.current = null);
      if (Math.abs(dx) < 10) return;
      g.on = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const dt = Math.max(1, e.timeStamp - g.lt);
    g.v = (e.clientX - g.lx) / dt;
    g.lx = e.clientX;
    g.lt = e.timeStamp;
    const shown = dx > 0 && !next ? dx * 0.15 : dx;
    x.set(shown);
    const reach = Math.min(110, g.w * 0.3);
    arm(shown > reach ? 1 : shown < -reach ? -1 : 0);
  };

  const up = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || !g.on) return;
    swiped.current = true;
    setTimeout(() => (swiped.current = false), 0);
    const flick = e.type === "pointerup" && Math.abs(g.v) > 0.6 && Math.abs(x.get()) > 40 ? (Math.sign(g.v) as -1 | 1) : 0;
    const dir = armedRef.current || flick;
    // A committed swipe keeps its strip lit while the card leaves; a short one springs back.
    if (dir === 1 && next) {
      arm(1);
      animate(x, g.w + 24, MOVE).then(() => onMove(card, next));
    } else if (dir === -1) {
      arm(-1);
      animate(x, -(g.w + 24), MOVE).then(() => onDelete(card));
    } else {
      arm(0);
      animate(x, 0, MOVE);
    }
  };

  return (
    <div className="ph-swipe">
      {next && (
        <motion.div className={`ph-act move${armed === 1 ? " armed" : ""}`} style={{ opacity: showMove }} aria-hidden>
          <ArrowRight size={18} strokeWidth={2} />
          {next.name}
        </motion.div>
      )}
      <motion.div className={`ph-act del${armed === -1 ? " armed" : ""}`} style={{ opacity: showDelete }} aria-hidden>
        Delete
        <Trash2 size={18} strokeWidth={2} />
      </motion.div>
      <motion.button
        className={`ph-card${card.label ? ` stock-${card.label}` : ""}`}
        style={{ x }}
        whileTap={{ scale: 0.985 }}
        transition={{ scale: { duration: 0.12, ease: EASE } }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={() => !swiped.current && onOpen(card)}
      >
        <span className="t">{card.title}</span>
        {due && <span className={`due${due.overdue ? " late" : ""}`}>{due.text}</span>}
      </motion.button>
    </div>
  );
}

function Capture({ lane, onAdded }: { lane: Lane | undefined; onAdded: () => void }) {
  const [text, setText] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lane || !text.trim()) return;
    a.submitNewCard(lane.id, text, "bottom");
    setText("");
    onAdded();
  };
  return (
    <form className="ph-capture" onSubmit={submit}>
      <input
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        placeholder={lane ? `Add to ${lane.name}` : "Add a card"}
        aria-label={lane ? `New card in ${lane.name}` : "New card"}
        enterKeyHint="send"
        autoCapitalize="sentences"
        autoComplete="off"
      />
      {/* Keep the keyboard up: the button must not take focus from the field. */}
      <button type="submit" className="ph-send" aria-label="Add card" disabled={!text.trim()} onPointerDown={(e) => e.preventDefault()}>
        <ArrowUp size={22} strokeWidth={2} />
      </button>
    </form>
  );
}

function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [toast, onDone]);
  return (
    <div className="ph-toast-wrap" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="ph-toast" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8, transition: OUT }} transition={MOVE}>
            <span>{toast.text}</span>
            <button
              onClick={() => {
                store.undo();
                onDone();
              }}
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Scrim({ onClose }: { onClose: () => void }) {
  return <motion.div className="ph-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: OUT }} transition={MOVE} onClick={onClose} />;
}

function Drawer({ boardId, lanes, counts, say }: { boardId: Id | null; lanes: Lane[]; counts: Record<Id, Card[]>; say: (t: string) => void }) {
  const data = useStore((s) => s.data);
  const editing = useStore((s) => s.ui.editing);
  const boards = useMemo(() => ops.boardsOf(data), [data]);
  const perBoard = useMemo(() => {
    const perLane: Record<Id, number> = {};
    for (const c of Object.values(data.cards)) perLane[c.laneId] = (perLane[c.laneId] ?? 0) + 1;
    return (id: Id) => ops.lanesOf(data, id).reduce((n, l) => n + (perLane[l.id] ?? 0), 0);
  }, [data]);
  const close = () => store.setUi({ drawer: false, editing: null });

  return (
    <>
      <Scrim onClose={close} />
      <motion.aside className="ph-drawer" aria-label="Boards and lanes" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%", transition: { duration: 0.22, ease: EASE } }} transition={PANE}>
        <h2 className="ph-h">Boards</h2>
        {boards.map((b) => (
          <button
            key={b.id}
            className={`ph-row${b.id === boardId ? " on" : ""}`}
            onClick={() => {
              a.selectBoard(b.id);
              close();
            }}
          >
            <span className="name">{b.name}</span>
            <span className="n">{perBoard(b.id)}</span>
          </button>
        ))}
        <button
          className="ph-row add"
          onClick={() => {
            a.newBoard();
            store.setUi({ drawer: false });
          }}
        >
          <Plus size={18} strokeWidth={1.75} /> New board
        </button>

        <h2 className="ph-h">Lanes</h2>
        {lanes.map((l) =>
          editing?.kind === "lane" && editing.laneId === l.id ? (
            <div key={l.id} className="ph-edit">
              <input
                className="ph-row"
                defaultValue={l.name === "New lane" ? "" : l.name}
                placeholder="Lane name"
                aria-label="Lane name"
                autoFocus
                enterKeyHint="done"
                onBlur={(e) => a.renameLane(l.id, e.currentTarget.value || l.name)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
              <button
                className="ph-icon"
                aria-label={`Delete ${l.name}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => {
                  store.commit((d) => ops.deleteLane(d, l.id), { editing: null, laneId: null, cardId: null });
                  say(`Deleted ${l.name}`);
                }}
              >
                <Trash2 size={18} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <button key={l.id} className="ph-row" onClick={() => store.setUi({ editing: { kind: "lane", laneId: l.id } })} aria-label={`${l.name}, rename`}>
              <span className="name">{l.name}</span>
              <span className="n">{counts[l.id]?.length ?? 0}</span>
            </button>
          ),
        )}
        <button className="ph-row add" onClick={a.newLane}>
          <Plus size={18} strokeWidth={1.75} /> New lane
        </button>

        <div className="ph-drawer-foot">
          <button
            className="ph-quiet"
            onClick={() => {
              a.deleteCurrentBoard();
              close();
              say("Deleted the board");
            }}
          >
            <Trash2 size={17} strokeWidth={1.75} /> Delete this board
          </button>
        </div>
      </motion.aside>
    </>
  );
}

function Sheet({ cardId, say }: { cardId: Id; say: (t: string) => void }) {
  const exists = useStore((s) => !!s.data.cards[cardId]);
  const selected = useStore((s) => s.ui.cardId);
  const controls = useDragControls();
  const close = useCallback(() => store.setUi({ sheet: false }), []);

  // Deleting from the sheet selects the next card; on a phone the sheet closes instead.
  useEffect(() => {
    if (!exists) {
      close();
      say("Deleted");
    } else if (selected !== cardId) close();
  }, [exists, selected, cardId, close, say]);

  return (
    <>
      <Scrim onClose={close} />
      <motion.div
        className="ph-sheet"
        role="dialog"
        aria-label="Card"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { duration: 0.22, ease: EASE } }}
        transition={PANE}
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.9 }}
        onDragEnd={(_, info) => (info.offset.y > 110 || info.velocity.y > 600) && close()}
      >
        <div className="ph-grab" onPointerDown={(e) => controls.start(e)}>
          <button className="ph-done" onClick={close}>
            Done
          </button>
        </div>
        <Inspector />
      </motion.div>
    </>
  );
}
