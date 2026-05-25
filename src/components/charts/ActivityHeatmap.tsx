/**
 * ActivityHeatmap — GitHub-style 7-row (Sun–Sat) grid.
 * Renders entirely as inline SVG; no external dependencies.
 */
import type { DayActivity } from "@/lib/activity";

const CELL = 12;
const GAP = 2;
const STEP = CELL + GAP;

const WEEK_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"]; // Sun=0 … Sat=6 (js getDay)

function intensityClass(count: number): string {
  if (count === 0) return "fill-muted stroke-border";
  if (count < 3)  return "fill-primary/25 stroke-primary/30";
  if (count < 6)  return "fill-primary/50 stroke-primary/50";
  if (count < 10) return "fill-primary/70 stroke-primary/70";
  return "fill-primary stroke-primary";
}

export function ActivityHeatmap({ data }: { data: DayActivity[] }) {
  if (data.length === 0) return null;

  // Pad the front so the first cell lands on the correct weekday column
  const firstDay = new Date(data[0].date + "T00:00:00Z").getUTCDay(); // 0=Sun
  const padded: (DayActivity | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...data,
  ];

  const weeks = Math.ceil(padded.length / 7);
  const svgW = weeks * STEP + 24; // extra 24 for day-of-week labels
  const svgH = 7 * STEP + 18;    // extra 18 for month labels (top)

  // Build month labels
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let i = 0; i < padded.length; i++) {
    const cell = padded[i];
    if (!cell) continue;
    const m = new Date(cell.date + "T00:00:00Z").getUTCMonth();
    if (m !== lastMonth) {
      const col = Math.floor(i / 7);
      monthLabels.push({
        col,
        label: new Date(cell.date + "T00:00:00Z").toLocaleDateString("he-IL", { month: "short" }),
      });
      lastMonth = m;
    }
  }

  return (
    <svg
      width={svgW}
      height={svgH}
      className="overflow-visible text-[10px]"
      aria-label="מפת חום פעילות"
    >
      {/* Month labels */}
      {monthLabels.map(({ col, label }) => (
        <text
          key={col}
          x={24 + col * STEP + CELL / 2}
          y={11}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize={9}
        >
          {label}
        </text>
      ))}

      {/* Day-of-week labels */}
      {WEEK_LABELS.map((l, row) => (
        <text
          key={row}
          x={18}
          y={18 + row * STEP + CELL * 0.75}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={9}
        >
          {row % 2 === 1 ? l : ""}
        </text>
      ))}

      {/* Cells */}
      {padded.map((cell, i) => {
        const col = Math.floor(i / 7);
        const row = i % 7;
        const x = 24 + col * STEP;
        const y = 18 + row * STEP;
        if (!cell) {
          return (
            <rect
              key={i}
              x={x} y={y}
              width={CELL} height={CELL}
              rx={2}
              className="fill-transparent stroke-none"
            />
          );
        }
        return (
          <rect
            key={i}
            x={x} y={y}
            width={CELL} height={CELL}
            rx={2}
            className={intensityClass(cell.count)}
            strokeWidth={0.5}
          >
            <title>{`${new Date(cell.date + "T00:00:00Z").toLocaleDateString("he-IL")}: ${cell.count} שאלות${cell.count > 0 ? ` (${cell.correct} נכון)` : ""}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
