import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useStore, store } from "../model/store";
import * as a from "../actions";
import { fields } from "./fields";
import { Keys } from "./Key";

export function Toolbar() {
  const data = useStore((s) => s.data);
  const boardSel = useStore((s) => s.ui.boardId);
  const editing = useStore((s) => s.ui.editing);
  const search = useStore((s) => s.ui.search);
  const density = useStore((s) => s.ui.density);
  const boardId = useMemo(() => a.currentBoardId(), [data, boardSel]);
  const board = boardId ? data.boards[boardId] : null;
  const size = Math.round((12.5 + 3 * density) * 10) / 10;

  return (
    <header className="toolbar" data-tauri-drag-region>
      {board && editing?.kind === "board" && editing.boardId === board.id ? (
        <input
          className="board-name editing"
          defaultValue={board.name}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => a.renameBoard(board.id, e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") store.setUi({ editing: null });
          }}
          aria-label="Board name"
        />
      ) : (
        <h1 className="board-name" onDoubleClick={() => board && store.setUi({ editing: { kind: "board", boardId: board.id } })}>
          {board?.name}
        </h1>
      )}
      <label className="density" title="Density: Cmd minus and Cmd equals">
        <input type="range" aria-label="Density" min={0} max={1} step={0.1} value={density} onChange={(e) => a.setDensity(Number(e.currentTarget.value))} />
        <span className="readout">{size} px</span>
      </label>
      <div className="search">
        <input
          ref={(el) => void (fields.search = el)}
          value={search}
          placeholder="Search cards"
          aria-label="Search cards"
          onChange={(e) => store.setUi({ search: e.currentTarget.value })}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              store.setUi({ search: "" });
              e.currentTarget.blur();
            }
            if (e.key === "Enter" || e.key === "ArrowDown") {
              e.preventDefault();
              e.currentTarget.blur();
              const lane = a.lanes().find((l) => a.visible(l.id).length);
              if (lane) a.select(lane.id, a.visible(lane.id)[0].id);
            }
          }}
        />
        {!search && <Keys keys={["/"]} />}
      </div>
      <button className="btn" onClick={() => a.startNewCard("bottom")}>
        <Plus size={15} strokeWidth={2} aria-hidden />
        New card
        <Keys keys={["N"]} />
      </button>
    </header>
  );
}
