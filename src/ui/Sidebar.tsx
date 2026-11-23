import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useStore } from "../model/store";
import { boardsOf, lanesOf } from "../model/ops";
import * as a from "../actions";
import { Keys } from "./Key";

export function Sidebar() {
  const data = useStore((s) => s.data);
  const boardSel = useStore((s) => s.ui.boardId);
  const laneSel = useStore((s) => s.ui.laneId);
  const boardId = useMemo(() => a.currentBoardId(), [data, boardSel]);
  const laneId = useMemo(() => a.currentLaneId(), [data, boardSel, laneSel]);
  const perLane = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of Object.values(data.cards)) m[c.laneId] = (m[c.laneId] ?? 0) + 1;
    return m;
  }, [data.cards]);
  const perBoard = (id: string) => lanesOf(data, id).reduce((n, l) => n + (perLane[l.id] ?? 0), 0);
  const boards = useMemo(() => boardsOf(data), [data]);
  const lanes = useMemo(() => (boardId ? lanesOf(data, boardId) : []), [data, boardId]);

  return (
    <aside className="side">
      <div className="side-top" data-tauri-drag-region />
      <nav aria-label="Boards">
        <h2 className="side-h">Boards</h2>
        {boards.map((b, i) => (
          <button key={b.id} className={`side-row${b.id === boardId ? " on" : ""}`} onClick={() => a.selectBoard(b.id)} title={i < 9 ? `⌘${i + 1}` : undefined}>
            <span className="name">{b.name}</span>
            <span className="n">{perBoard(b.id)}</span>
          </button>
        ))}
        <button className="side-row add" onClick={a.newBoard}>
          <Plus size={15} strokeWidth={1.75} aria-hidden />
          <span className="name">New board</span>
          <span className="n"><Keys keys={["⌘", "N"]} /></span>
        </button>
      </nav>
      <nav aria-label="Lanes">
        <h2 className="side-h">Lanes</h2>
        {lanes.map((l) => (
          <button
            key={l.id}
            className={`side-row${l.id === laneId ? " here" : ""}`}
            onClick={() => {
              a.select(l.id, a.visible(l.id)[0]?.id ?? null);
              document.querySelector(`[data-lane="${l.id}"]`)?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
            }}
          >
            <span className="name">{l.name}</span>
            <span className="n">{perLane[l.id] ?? 0}</span>
          </button>
        ))}
        <button className="side-row add" onClick={a.newLane}>
          <Plus size={15} strokeWidth={1.75} aria-hidden />
          <span className="name">New lane</span>
        </button>
      </nav>
    </aside>
  );
}
