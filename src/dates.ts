const pad = (n: number) => String(n).padStart(2, "0");
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoDay(new Date());
export const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDay(d);
};

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** "Today", "Tomorrow", "Nov 24"; overdue when the day has passed. */
export function dueLabel(due: string): { text: string; overdue: boolean } {
  const t = today();
  if (due === t) return { text: "Today", overdue: false };
  if (due === addDays(1)) return { text: "Tomorrow", overdue: false };
  const [y, m, d] = due.split("-").map(Number);
  const text = fmt.format(new Date(y, m - 1, d));
  return due < t ? { text: `Overdue, ${text}`, overdue: true } : { text, overdue: false };
}
