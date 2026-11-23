import { useStore } from "../model/store";
import { Keys } from "./Key";

export function HintBar() {
  const saveError = useStore((s) => s.ui.saveError);
  return (
    <footer className="hints">
      <span><Keys keys={["⇧", "←", "→"]} /> lane</span>
      <span><Keys keys={["⇧", "↑", "↓"]} /> reorder</span>
      <span><Keys keys={["↵"]} /> rename</span>
      <span><Keys keys={["E"]} /> notes</span>
      <span><Keys keys={["⌫"]} /> delete</span>
      <span><Keys keys={["⌘", "Z"]} /> undo</span>
      <span><Keys keys={["⌘", "K"]} /> commands</span>
      <span><Keys keys={["?"]} /> all keys</span>
      {saveError && <span className="save-error" role="alert">Not saved: {saveError}. Retrying.</span>}
    </footer>
  );
}
