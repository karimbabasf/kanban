import { useLayoutEffect, useMemo, useRef } from "react";
import { Trash2, X } from "lucide-react";
import { useStore, store } from "../model/store";
import { lanesOf } from "../model/ops";
import { LABELS } from "../model/types";
import * as a from "../actions";
import { fields } from "./fields";
import { Keys } from "./Key";

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
}

const created = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function Inspector() {
  const data = useStore((s) => s.data);
  const ui = useStore((s) => s.ui);
  const card = useMemo(() => a.currentCard(), [data, ui.cardId, ui.laneId, ui.boardId]);
  const lanes = useMemo(() => (card ? lanesOf(data, data.lanes[card.laneId].boardId) : []), [data, card]);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    autosize(titleRef.current);
    autosize(notesRef.current);
  }, [card?.id, card?.title, card?.notes, ui.density]);

  const back = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      (e.target as HTMLElement).blur();
      store.setUi({ sheet: false });
    }
  };

  if (!card) {
    return (
      <aside className="insp empty" aria-label="Card">
        <div className="insp-top" data-tauri-drag-region />
        <p className="empty-title">No card selected</p>
        <p className="empty-body">
          Press <Keys keys={["N"]} /> to add one, or pick a card with the arrows.
        </p>
      </aside>
    );
  }

  return (
    <aside className="insp" aria-label="Card" onKeyDown={back}>
      <div className="insp-top" data-tauri-drag-region />
      <textarea
        ref={titleRef}
        className="insp-title"
        rows={1}
        value={card.title}
        aria-label="Title"
        onChange={(e) => {
          a.editCard(card.id, { title: e.currentTarget.value.replace(/\n/g, " ") }, `title:${card.id}`);
          autosize(e.currentTarget);
        }}
        onBlur={(e) => !e.currentTarget.value.trim() && a.editCard(card.id, { title: "Untitled" })}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), notesRef.current?.focus())}
      />
      <textarea
        ref={(el) => {
          notesRef.current = el;
          fields.notes = el;
        }}
        className="field notes"
        rows={3}
        value={card.notes}
        placeholder="Notes"
        aria-label="Notes"
        onChange={(e) => {
          a.editCard(card.id, { notes: e.currentTarget.value }, `notes:${card.id}`);
          autosize(e.currentTarget);
        }}
      />
      <div className="row">
        <label className={`field due-field${card.due ? "" : " empty"}`}>
          <span className="sr">Due date</span>
          {!card.due && <span className="no-due" aria-hidden>No due date</span>}
          <input
            ref={(el) => void (fields.due = el)}
            type="date"
            value={card.due ?? ""}
            onChange={(e) => a.editCard(card.id, { due: e.currentTarget.value || null })}
          />
          {card.due && (
            <button className="icon" onClick={() => a.editCard(card.id, { due: null })} aria-label="Clear due date">
              <X size={15} strokeWidth={1.75} />
            </button>
          )}
        </label>
        <button className="field quick" onClick={() => a.dueSelected("today")}>
          Today <Keys keys={["T"]} />
        </button>
      </div>
      <div className="swatches" role="radiogroup" aria-label="Color">
        {LABELS.map((l, i) => (
          <button
            key={l}
            role="radio"
            aria-checked={card.label === l}
            aria-label={`Color ${i + 1}`}
            className={`swatch ink-${l}${card.label === l ? " on" : ""}`}
            onClick={() => a.labelSelected(i + 1)}
          />
        ))}
        <span className="swatch-hint"><Keys keys={["1", "to", "5"]} /></span>
      </div>
      <div className="seg" role="radiogroup" aria-label="Lane">
        {lanes.map((l) => (
          <button key={l.id} role="radio" aria-checked={l.id === card.laneId} className={l.id === card.laneId ? "on" : ""} onClick={() => a.moveSelectedToLane(l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      <div className="insp-foot">
        <span>Added {created.format(card.createdAt)}</span>
        <button className="btn quiet" onClick={a.deleteSelected}>
          <Trash2 size={15} strokeWidth={1.75} aria-hidden />
          Delete <Keys keys={["⌫"]} />
        </button>
      </div>
    </aside>
  );
}
