import { ArrowBigUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Command, CornerDownLeft, Delete, type LucideIcon } from "lucide-react";

// Mac key symbols are drawn as icons, so no glyph falls back to another font.
const ICONS: Record<string, LucideIcon> = {
  "⌘": Command,
  "⇧": ArrowBigUp,
  "⌫": Delete,
  "↵": CornerDownLeft,
  "←": ArrowLeft,
  "→": ArrowRight,
  "↑": ArrowUp,
  "↓": ArrowDown,
};

export function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="keys">
      {keys.map((k, i) => {
        if (k === "to") return <span key={i} className="to">to</span>;
        const Icon = ICONS[k];
        return <kbd key={i}>{Icon ? <Icon size={11} strokeWidth={2.25} aria-label={k} /> : k}</kbd>;
      })}
    </span>
  );
}
