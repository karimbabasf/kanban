import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useStore } from "../model/store";
import { onKey } from "../keys";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { Board, DragOverlay } from "./Board";
import { Inspector } from "./Inspector";
import { HintBar } from "./HintBar";
import { Palette } from "./Palette";
import { Help } from "./Help";
import { store } from "../model/store";

// One curve everywhere; three durations: 0.12 feedback, 0.22 moves and dialogs, 0.32 panes.
export const ease = [0.2, 0, 0, 1] as const;
const base = { duration: 0.22, ease } as const;
const pane = { duration: 0.32, ease } as const;
const snap = { duration: 0 } as const;
const paneVariants = {
  shut: (instant: boolean) => ({ width: 0, transition: instant ? snap : pane }),
  open: (instant: boolean) => ({ width: "var(--w)", transition: instant ? snap : pane }),
};

type Mode = "wide" | "mid" | "narrow";
function useMode(): Mode {
  const get = (): Mode => (innerWidth >= 1320 ? "wide" : innerWidth >= 900 ? "mid" : "narrow");
  const [m, setM] = useState(get);
  useEffect(() => {
    const on = () => setM(get());
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);
  return m;
}

export function App() {
  const ready = useStore((s) => s.ready);
  const density = useStore((s) => s.ui.density);
  const sidebar = useStore((s) => s.ui.sidebar);
  const inspector = useStore((s) => s.ui.inspector);
  const drawer = useStore((s) => s.ui.drawer);
  const sheet = useStore((s) => s.ui.sheet);
  const palette = useStore((s) => s.ui.palette);
  const help = useStore((s) => s.ui.help);
  const mode = useMode();
  // Panes slide when toggled, but snap when a window resize crosses a size step.
  const lastMode = useRef(mode);
  const instant = lastMode.current !== mode;
  useEffect(() => void (lastMode.current = mode), [mode]);

  useEffect(() => {
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => store.setUi({ sheet: false, drawer: false }), [mode]);

  if (!ready) return <div className="app loading" />;
  const side = mode !== "narrow" && sidebar;
  const insp = mode === "wide" && inspector;
  const style = { "--d": density } as React.CSSProperties;

  return (
    <MotionConfig reducedMotion="user" transition={base}>
      <div className={`app${side ? "" : " no-side"}`} style={style}>
        <AnimatePresence initial={false} custom={instant}>
          {side && (
            <motion.div key="side" className="pane side-pane" custom={instant} variants={paneVariants} initial="shut" animate="open" exit="shut">
              <Sidebar />
            </motion.div>
          )}
        </AnimatePresence>
        <main className="main" onPointerDown={() => (sheet || drawer) && store.setUi({ sheet: false, drawer: false })}>
          <Toolbar />
          <Board />
          <HintBar />
        </main>
        <AnimatePresence initial={false} custom={instant}>
          {insp && (
            <motion.div key="insp" className="pane insp-pane" custom={instant} variants={paneVariants} initial="shut" animate="open" exit="shut">
              <Inspector />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {mode === "narrow" && drawer && (
            <motion.div key="drawer" className="float float-left" initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -16, opacity: 0, transition: { duration: 0.16, ease } }}>
              <Sidebar />
            </motion.div>
          )}
          {mode !== "wide" && sheet && (
            <motion.div key="sheet" className="float float-right" initial={{ x: 16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 16, opacity: 0, transition: { duration: 0.16, ease } }}>
              <Inspector />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>{palette && <Palette key="palette" />}</AnimatePresence>
        <AnimatePresence>{help && <Help key="help" />}</AnimatePresence>
        <DragOverlay />
      </div>
    </MotionConfig>
  );
}
