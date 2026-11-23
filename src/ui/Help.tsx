import { useEffect } from "react";
import { motion } from "motion/react";
import { store } from "../model/store";
import { SHORTCUTS } from "../keys";
import { Keys } from "./Key";

export function Help() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        store.setUi({ help: false });
      }
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, []);
  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.14 } }} onClick={() => store.setUi({ help: false })}>
      <motion.div
        className="dialog help"
        role="dialog"
        aria-label="Keyboard shortcuts"
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.14 } }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Keyboard</h2>
        <dl>
          {SHORTCUTS.map((s) => (
            <div key={s.label}>
              <dt><Keys keys={s.keys} /></dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </motion.div>
  );
}
