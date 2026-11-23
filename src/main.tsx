import "@fontsource-variable/google-sans-flex/full.css";
import "./styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { boot } from "./model/persist";
import { seed } from "./model/ops";

boot(seed).catch((err) => {
  document.body.textContent = `Kanban could not open its data: ${String(err?.message ?? err)}`;
});
createRoot(document.getElementById("root")!).render(<App />);
