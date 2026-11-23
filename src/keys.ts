import { store } from "./model/store";
import * as a from "./actions";
import { fields } from "./ui/fields";

/** Every shortcut, shown in the help sheet and the command palette. */
export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["↑", "↓", "←", "→"], label: "Move the selection (or H J K L)" },
  { keys: ["⇧", "←", "→"], label: "Move the card to the next lane" },
  { keys: ["⇧", "↑", "↓"], label: "Reorder the card" },
  { keys: ["N"], label: "New card at the bottom of the lane" },
  { keys: ["⇧", "N"], label: "New card at the top of the lane" },
  { keys: ["↵"], label: "Rename the card" },
  { keys: ["E"], label: "Edit notes" },
  { keys: ["1", "to", "5"], label: "Color the card, 0 clears" },
  { keys: ["T"], label: "Due today, Shift T clears the date" },
  { keys: ["D"], label: "Pick a due date" },
  { keys: ["⌫"], label: "Delete the card" },
  { keys: ["⌘", "Z"], label: "Undo, add Shift to redo" },
  { keys: ["/"], label: "Search this board" },
  { keys: ["⌘", "K"], label: "Commands" },
  { keys: ["⌘", "1", "to", "9"], label: "Switch board" },
  { keys: ["⌘", "N"], label: "New board" },
  { keys: ["⌘", "-", "="], label: "Denser or roomier, Cmd 0 resets" },
  { keys: ["⌘", "\\"], label: "Show or hide the sidebar" },
  { keys: ["⌘", "I"], label: "Show or hide the inspector" },
  { keys: ["?"], label: "All shortcuts" },
];

export function openNotes() {
  const ui = store.state.ui;
  if (!a.currentCard()) return;
  if (!ui.inspector) store.setUi({ inspector: true });
  store.setUi({ sheet: true });
  // Focus now when the inspector is already on screen, so a fast next key lands in the notes.
  if (fields.notes?.isConnected) fields.notes.focus();
  else requestAnimationFrame(() => fields.notes?.focus());
}

export function openDue() {
  if (!a.currentCard()) return;
  store.setUi({ inspector: true, sheet: true });
  requestAnimationFrame(() => {
    const el = fields.due;
    if (!el) return;
    el.focus();
    try {
      el.showPicker();
    } catch {
      /* the field is focused either way */
    }
  });
}

export function onKey(e: KeyboardEvent) {
  const ui = store.state.ui;
  const t = e.target as HTMLElement | null;
  const typing = !!t?.closest?.("input, textarea, select, [contenteditable='true']");
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key;
  const done = () => e.preventDefault();

  if (ui.palette || ui.help) return; // the overlay owns the keyboard
  if (ui.drag) {
    if (k === "Escape") done();
    return;
  }

  if (mod) {
    const lower = k.toLowerCase();
    if (lower === "k") return done(), store.setUi({ palette: true });
    if (lower === "z" && !typing) return done(), e.shiftKey ? a.redo() : a.undo();
    if (lower === "n") return done(), a.newBoard();
    if (lower === "f") return done(), fields.search?.focus();
    if (k === "\\") return done(), store.setUi({ sidebar: !ui.sidebar, drawer: !ui.drawer });
    if (lower === "i") return done(), store.setUi({ inspector: !ui.inspector, sheet: !ui.sheet });
    if (k === "=" || k === "+") return done(), a.setDensity(ui.density + a.DENSITY_STEP);
    if (k === "-") return done(), a.setDensity(ui.density - a.DENSITY_STEP);
    if (k === "0") return done(), a.setDensity(0.5);
    if (/^[1-9]$/.test(k)) return done(), a.selectBoardAt(Number(k) - 1);
    if (!typing && k === "ArrowUp") return done(), e.shiftKey ? a.moveCardBy("top") : a.moveSelection("top");
    if (!typing && k === "ArrowDown") return done(), e.shiftKey ? a.moveCardBy("bottom") : a.moveSelection("bottom");
    if (!typing && (k === "Backspace" || k === "Delete")) return done(), a.deleteSelected();
    return;
  }
  if (e.altKey || typing) return;

  const shift = e.shiftKey;
  switch (k) {
    case "ArrowUp": case "k": case "K":
      return done(), shift ? a.moveCardBy("up") : a.moveSelection("up");
    case "ArrowDown": case "j": case "J":
      return done(), shift ? a.moveCardBy("down") : a.moveSelection("down");
    case "ArrowLeft": case "h": case "H":
      return done(), shift ? a.moveCardBy("left") : a.moveSelection("left");
    case "ArrowRight": case "l": case "L":
      return done(), shift ? a.moveCardBy("right") : a.moveSelection("right");
    case "g": return done(), a.moveSelection("top");
    case "G": return done(), a.moveSelection("bottom");
    case "n": return done(), a.startNewCard("bottom");
    case "N": return done(), a.startNewCard("top");
    case "Enter": {
      done();
      const c = a.currentCard();
      return c ? store.setUi({ editing: { kind: "title", cardId: c.id } }) : a.startNewCard("bottom");
    }
    case "e": case "E": return done(), openNotes();
    case "d": case "D": return done(), openDue();
    case "t": return done(), a.dueSelected("today");
    case "T": return done(), a.dueSelected("clear");
    case "Backspace": case "Delete": return done(), a.deleteSelected();
    case "/": return done(), fields.search?.focus();
    case "?": return done(), store.setUi({ help: true });
    case "Escape":
      if (ui.sheet || ui.drawer) return done(), store.setUi({ sheet: false, drawer: false });
      if (ui.search) return done(), store.setUi({ search: "" });
      return;
  }
  if (/^[0-5]$/.test(k)) return done(), a.labelSelected(Number(k));
}
