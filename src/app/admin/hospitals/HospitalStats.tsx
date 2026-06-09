"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export type HospitalRow = {
  hospital: string;
  isNull: boolean;
  totalUsers: number;
  active7: number;
  active30: number;
  attempts: number;
  accuracy: number | null;
};

type Summary = {
  hospitalCount: number;
  usersWithHospital: number;
  usersWithoutHospital: number;
  totalUsers: number;
};

type ViewId = "bars" | "heatmap" | "scatter" | "activity";
type SortKey = "hospital" | "totalUsers" | "active7" | "active30" | "attempts" | "accuracy";
type SortOrder = "asc" | "desc";

const VIEWS: ReadonlyArray<{ id: ViewId; label: string }> = [
  { id: "bars", label: "דירוג" },
  { id: "heatmap", label: "מפת חום" },
  { id: "scatter", label: "פיזור" },
  { id: "activity", label: "פעילות" },
];

const collator = new Intl.Collator("he", { sensitivity: "base" });

/** Hue from accuracy: 0% → red (0), 100% → green (120). Null → neutral blue. */
function hueFor(accuracy: number | null): number {
  if (accuracy === null) return 215;
  return Math.round((accuracy / 100) * 120);
}

function shortLabel(name: string): string {
  // Trim long Hebrew hospital names for chart axes/labels.
  const cleaned = name
    .replace(/^המרכז הרפואי\s+/, "")
    .replace(/^מרכז רפואי\s+/, "")
    .replace(/^בית חולים\s+/, "")
    .replace(/^בית החולים\s+/, "");
  return cleaned.length > 16 ? `${cleaned.slice(0, 15)}…` : cleaned;
}

export function HospitalStats({
  rows,
  summary,
}: {
  rows: HospitalRow[];
  summary: Summary;
}) {
  const [view, setView] = useState<ViewId>("bars");

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={summary.hospitalCount} label="בתי חולים פעילים" tone="blue" />
        <StatCard value={summary.totalUsers} label="סה״כ משתמשים" tone="default" />
        <StatCard value={summary.usersWithHospital} label="משתמשים עם בית חולים" tone="emerald" />
        <StatCard value={summary.usersWithoutHospital} label="ללא בית חולים" tone="amber" />
      </div>

      {/* View switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-card p-3">
        <h2 className="font-display text-base font-semibold">המחשה חזותית</h2>
        <div
          role="radiogroup"
          aria-label="סוג תרשים"
          className="inline-flex flex-wrap rounded border bg-background p-0.5"
        >
          {VIEWS.map((v) => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setView(v.id)}
                className={
                  "rounded px-3 py-1 text-xs font-medium transition-colors " +
                  (active
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded border bg-card p-4">
        {rows.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            אין נתונים להצגה
          </div>
        ) : view === "bars" ? (
          <BarsView rows={rows} />
        ) : view === "heatmap" ? (
          <HeatmapView rows={rows} />
        ) : view === "scatter" ? (
          <ScatterView rows={rows} />
        ) : (
          <ActivityView rows={rows} />
        )}
      </div>

      <HospitalTable rows={rows} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "default" | "blue" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-600 dark:text-blue-400"
      : tone === "emerald"
        ? "text-emerald-600 dark:text-emerald-400"
        : tone === "amber"
          ? "text-amber-600 dark:text-amber-400"
          : "";
  return (
    <div className="rounded border bg-card p-3">
      <div className={`text-2xl font-bold font-mono ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2D horizontal bar chart: length = users, color = accuracy          */
/* ------------------------------------------------------------------ */

const TOP_N = 12;

function BarsView({ rows }: { rows: HospitalRow[] }) {
  const data = useMemo(
    () =>
      [...rows]
        .filter((r) => r.totalUsers > 0)
        .sort((a, b) => b.totalUsers - a.totalUsers)
        .slice(0, TOP_N),
    [rows],
  );
  const maxUsers = Math.max(1, ...data.map((d) => d.totalUsers));

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {data.map((d) => {
          const pct = (d.totalUsers / maxUsers) * 100;
          const hue = hueFor(d.accuracy);
          return (
            <div key={d.hospital} className="group flex items-center gap-3">
              <div
                className="w-36 shrink-0 truncate text-end text-xs text-muted-foreground group-hover:text-foreground"
                title={d.hospital}
              >
                {shortLabel(d.hospital)}
              </div>
              <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-muted/40">
                <div
                  className="flex h-full items-center justify-end rounded-md px-2 transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max(pct, 3)}%`,
                    background: `linear-gradient(90deg, hsl(${hue} 70% 42%), hsl(${hue} 72% 55%))`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
                  }}
                >
                  <span className="text-xs font-bold text-white drop-shadow-sm">
                    {d.totalUsers}
                  </span>
                </div>
                {d.accuracy !== null && (
                  <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[10px] font-medium text-muted-foreground">
                    {d.accuracy}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-muted-foreground">
        <span>אורך = מספר משתמשים</span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          צבע = אחוז הצלחה
          <span className="inline-block h-2 w-16 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500" />
        </span>
        {rows.filter((r) => r.totalUsers > 0).length > TOP_N && (
          <>
            <span aria-hidden>·</span>
            <span>מציג {TOP_N} מובילים</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Heatmap (treemap): area = users, color = accuracy                  */
/* ------------------------------------------------------------------ */

type TreemapDatum = { name: string; size: number; accuracy: number | null };

function HeatmapView({ rows }: { rows: HospitalRow[] }) {
  const data: TreemapDatum[] = useMemo(
    () =>
      rows
        .filter((r) => r.totalUsers > 0)
        .map((r) => ({ name: r.hospital, size: r.totalUsers, accuracy: r.accuracy })),
    [rows],
  );

  return (
    <div className="space-y-2" dir="ltr">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            nameKey="name"
            stroke="hsl(var(--card))"
            isAnimationActive={false}
            content={<TreemapCell />}
          >
            <Tooltip content={<TreemapTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground" dir="rtl">
        <span>שטח = מספר משתמשים · צבע = אחוז הצלחה</span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapCell(props: any) {
  const { x, y, width, height, name, accuracy } = props;
  if (width <= 0 || height <= 0) return null;
  const hue = hueFor(accuracy ?? null);
  const fill = `hsl(${hue} 65% 48%)`;
  const showLabel = width > 56 && height > 28;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill, stroke: "hsl(var(--card))", strokeWidth: 2 }}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize={11}
          fontWeight={600}
        >
          {shortLabel(name)}
        </text>
      )}
    </g>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as TreemapDatum;
  return (
    <div className="rounded border bg-card p-2 text-xs shadow" dir="rtl">
      <div className="font-semibold">{d.name}</div>
      <div className="text-muted-foreground">{d.size} משתמשים</div>
      <div className="text-muted-foreground">
        אחוז הצלחה: {d.accuracy === null ? "—" : `${d.accuracy}%`}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scatter / bubble: x = users, y = accuracy, size = attempts         */
/* ------------------------------------------------------------------ */

function ScatterView({ rows }: { rows: HospitalRow[] }) {
  const data = useMemo(
    () =>
      rows
        .filter((r) => r.totalUsers > 0 && r.accuracy !== null)
        .map((r) => ({
          x: r.totalUsers,
          y: r.accuracy as number,
          z: Math.max(1, r.attempts),
          name: r.hospital,
          attempts: r.attempts,
        })),
    [rows],
  );

  return (
    <div className="space-y-2" dir="ltr">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted-foreground/20" />
            <XAxis
              type="number"
              dataKey="x"
              name="משתמשים"
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-muted-foreground"
              label={{ value: "משתמשים", position: "insideBottom", offset: -14, fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="אחוז הצלחה"
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-muted-foreground"
              label={{ value: "% הצלחה", angle: -90, position: "insideLeft", fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="z" range={[80, 900]} name="ניסיונות" />
            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={`hsl(${hueFor(d.y)} 68% 50%)`} fillOpacity={0.78} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center text-[11px] text-muted-foreground" dir="rtl">
        כל בועה = בית חולים · גודל הבועה = מספר ניסיונות
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScatterTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border bg-card p-2 text-xs shadow" dir="rtl">
      <div className="font-semibold">{d.name}</div>
      <div className="text-muted-foreground">{d.x} משתמשים</div>
      <div className="text-muted-foreground">{d.y}% הצלחה</div>
      <div className="text-muted-foreground">{d.attempts} ניסיונות</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity stacked bars                                              */
/* ------------------------------------------------------------------ */

function ActivityView({ rows }: { rows: HospitalRow[] }) {
  const data = useMemo(
    () =>
      [...rows]
        .filter((r) => r.totalUsers > 0)
        .sort((a, b) => b.totalUsers - a.totalUsers)
        .slice(0, 14)
        .map((r) => ({
          name: shortLabel(r.hospital),
          full: r.hospital,
          veryActive: r.active7,
          active: Math.max(0, r.active30 - r.active7),
          inactive: Math.max(0, r.totalUsers - r.active30),
        })),
    [rows],
  );

  return (
    <div className="space-y-2" dir="ltr">
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 56, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted-foreground/20" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              interval={0}
              angle={-35}
              textAnchor="end"
              height={60}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-muted-foreground"
              width={36}
            />
            <Tooltip content={<ActivityTooltip />} cursor={{ fill: "rgba(100,116,139,0.08)" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="veryActive" stackId="a" name="פעיל ב‑7 ימים" fill="hsl(142 70% 45%)" />
            <Bar dataKey="active" stackId="a" name="פעיל ב‑30 ימים" fill="hsl(48 95% 55%)" />
            <Bar dataKey="inactive" stackId="a" name="לא פעיל" fill="hsl(215 16% 65%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActivityTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border bg-card p-2 text-xs shadow" dir="rtl">
      <div className="font-semibold">{d.full}</div>
      <div className="text-emerald-600 dark:text-emerald-400">פעיל ב‑7 ימים: {d.veryActive}</div>
      <div className="text-amber-600 dark:text-amber-400">פעיל ב‑30 ימים: {d.active}</div>
      <div className="text-muted-foreground">לא פעיל: {d.inactive}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sortable data table                                                */
/* ------------------------------------------------------------------ */

const DEFAULT_ORDER: Record<SortKey, SortOrder> = {
  hospital: "asc",
  totalUsers: "desc",
  active7: "desc",
  active30: "desc",
  attempts: "desc",
  accuracy: "desc",
};

function TableHeader({
  field,
  label,
  align = "start",
  sort,
  order,
  onSort,
}: {
  field: SortKey;
  label: string;
  align?: "start" | "center";
  sort: SortKey;
  order: SortOrder;
  onSort: (key: SortKey) => void;
}) {
  const indicator = sort !== field ? "" : order === "asc" ? " ▲" : " ▼";
  return (
    <th
      className={`p-2 ${align === "center" ? "text-center" : "text-start"} whitespace-nowrap text-muted-foreground`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        <span>{label}</span>
        <span aria-hidden="true">{indicator}</span>
      </button>
    </th>
  );
}

function HospitalTable({ rows }: { rows: HospitalRow[] }) {
  const [sort, setSort] = useState<SortKey>("totalUsers");
  const [order, setOrder] = useState<SortOrder>("desc");

  const sorted = useMemo(() => {
    const dir = order === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort === "hospital") return dir * collator.compare(a.hospital, b.hospital);
      if (sort === "accuracy") {
        const av = a.accuracy ?? -1;
        const bv = b.accuracy ?? -1;
        return dir * (av - bv);
      }
      return dir * ((a[sort] as number) - (b[sort] as number));
    });
  }, [rows, sort, order]);

  function toggleSort(key: SortKey) {
    if (key === sort) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setOrder(DEFAULT_ORDER[key]);
    }
  }

  if (rows.length === 0) return null;

  const headerProps = { sort, order, onSort: toggleSort };

  return (
    <div className="overflow-x-auto rounded border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <TableHeader field="hospital" label="בית חולים" {...headerProps} />
            <TableHeader field="totalUsers" label="משתמשים" align="center" {...headerProps} />
            <TableHeader field="active7" label="פעילים 7י׳" align="center" {...headerProps} />
            <TableHeader field="active30" label="פעילים 30י׳" align="center" {...headerProps} />
            <TableHeader field="attempts" label="ניסיונות" align="center" {...headerProps} />
            <TableHeader field="accuracy" label="אחוז הצלחה" align="center" {...headerProps} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.hospital} className="border-b transition-colors hover:bg-muted/30">
              <td className="p-2">
                {r.isNull ? (
                  <span className="italic text-muted-foreground">{r.hospital}</span>
                ) : (
                  r.hospital
                )}
              </td>
              <td className="p-2 text-center font-mono">{r.totalUsers}</td>
              <td className="p-2 text-center font-mono text-emerald-600 dark:text-emerald-400">
                {r.active7}
              </td>
              <td className="p-2 text-center font-mono">{r.active30}</td>
              <td className="p-2 text-center font-mono">{r.attempts}</td>
              <td className="p-2 text-center">
                {r.accuracy === null ? (
                  <span className="italic text-muted-foreground/50">—</span>
                ) : (
                  <span
                    className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
                    style={{ background: `hsl(${hueFor(r.accuracy)} 65% 45%)` }}
                  >
                    {r.accuracy}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
