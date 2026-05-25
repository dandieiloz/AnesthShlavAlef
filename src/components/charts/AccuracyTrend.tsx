/**
 * AccuracyTrend — simple responsive SVG line chart for rolling accuracy.
 * No external chart library needed.
 */
import type { AccuracyPoint } from "@/lib/activity";

const CHART_H = 80;
const MIN_POINTS = 2;

export function AccuracyTrend({ data }: { data: AccuracyPoint[] }) {
  if (data.length < MIN_POINTS) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        נדרשות לפחות {MIN_POINTS} נקודות נתונים לתצוגת גרף
      </p>
    );
  }

  const maxPct = 100;
  const minPct = 0;
  const range = maxPct - minPct;

  // Normalise to [0, CHART_H]
  const toY = (pct: number) =>
    CHART_H - ((pct - minPct) / range) * CHART_H;

  const n = data.length;

  // Build path as viewBox 0 0 100 CHART_H for easy scaling
  const points = data.map((d, i) => ({
    x: (i / (n - 1)) * 100,
    y: toY(d.accuracyPct),
    pct: d.accuracyPct,
    date: d.date,
    count: d.count,
  }));

  const linePath =
    "M " +
    points
      .map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" L ");

  // Area fill — close below the line
  const areaPath =
    linePath +
    ` L ${points[n - 1].x.toFixed(2)} ${CHART_H} L 0 ${CHART_H} Z`;

  // 70% reference line y position
  const y70 = toY(70);
  const y50 = toY(50);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 100 ${CHART_H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: CHART_H }}
        aria-label="גרף דיוק לאורך זמן"
      >
        {/* Reference lines */}
        <line x1="0" y1={y70.toFixed(2)} x2="100" y2={y70.toFixed(2)}
          className="stroke-success/30" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="0" y1={y50.toFixed(2)} x2="100" y2={y50.toFixed(2)}
          className="stroke-warning/30" strokeWidth="0.5" strokeDasharray="2 2" />

        {/* Area */}
        <path d={areaPath} className="fill-primary/10" />

        {/* Line */}
        <path d={linePath} fill="none" className="stroke-primary" strokeWidth="1.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r="1.5"
            className="fill-primary">
            <title>{`${new Date(p.date + "T00:00:00Z").toLocaleDateString("he-IL")}: ${p.pct}% (${p.count} שאלות)`}</title>
          </circle>
        ))}
      </svg>

      {/* Y-axis labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{data[0] && new Date(data[0].date + "T00:00:00Z").toLocaleDateString("he-IL", { day: "numeric", month: "short" })}</span>
        <span>{data[data.length - 1] && new Date(data[data.length - 1].date + "T00:00:00Z").toLocaleDateString("he-IL", { day: "numeric", month: "short" })}</span>
      </div>
    </div>
  );
}
