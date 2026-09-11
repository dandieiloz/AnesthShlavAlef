"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Metric = "active" | "attempts" | "signups" | "visits" | "visitors";
type Granularity = "hour" | "day" | "month";
type RangeMode = Granularity | "custom";

type Point = { bucket: string } & Partial<Record<Metric, number>>;

const METRICS: ReadonlyArray<{ id: Metric; label: string }> = [
  { id: "attempts", label: "שאלות שנענו" },
  { id: "visits", label: "ביקורים" },
  { id: "visitors", label: "מבקרים ייחודיים" },
  { id: "active", label: "פותרים פעילים" },
  { id: "signups", label: "הרשמות חדשות" },
];

const GRANULARITIES: ReadonlyArray<{ id: Granularity; label: string }> = [
  { id: "hour", label: "שעות (48ש׳)" },
  { id: "day", label: "ימים (30י׳)" },
  { id: "month", label: "חודשים (12ח׳)" },
];

const RANGES: ReadonlyArray<{ id: RangeMode; label: string }> = [
  ...GRANULARITIES,
  { id: "custom", label: "מותאם" },
];

const METRIC_STYLES: Record<Metric, { color: string; dash?: string }> = {
  attempts: { color: "hsl(217 91% 55%)" },
  visits: { color: "hsl(142 69% 40%)", dash: "8 3" },
  visitors: { color: "hsl(38 92% 50%)", dash: "4 3" },
  active: { color: "hsl(280 68% 52%)", dash: "10 3 2 3" },
  signups: { color: "hsl(0 72% 54%)", dash: "2 3" },
};

const METRIC_LABELS = Object.fromEntries(METRICS.map(({ id, label }) => [id, label])) as Record<
  Metric,
  string
>;

function getIsraelDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date());
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatBucket(iso: string, granularity: Granularity): string {
  const d = new Date(iso);
  if (granularity === "hour") {
    return new Intl.DateTimeFormat("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Jerusalem",
    }).format(d);
  }
  if (granularity === "day") {
    return new Intl.DateTimeFormat("he-IL", {
      day: "2-digit",
      month: "2-digit",
      timeZone: "Asia/Jerusalem",
    }).format(d);
  }
  return new Intl.DateTimeFormat("he-IL", {
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

export function UserActivityChart() {
  const today = getIsraelDate();
  const [selectedMetrics, setSelectedMetrics] = useState<Set<Metric>>(
    () => new Set(["attempts"]),
  );
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [effectiveGranularity, setEffectiveGranularity] = useState<Granularity>("day");
  const [fromDate, setFromDate] = useState(() => shiftDate(today, -29));
  const [toDate, setToDate] = useState(today);
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedMetricList = METRICS.filter(({ id }) => selectedMetrics.has(id)).map(({ id }) => id);
  const selectedMetricKey = selectedMetricList.join(",");
  const rangeIsValid = fromDate !== "" && toDate !== "" && fromDate <= toDate && toDate <= today;

  useEffect(() => {
    if (rangeMode === "custom" && appliedRange === null) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    const params = new URLSearchParams({ metrics: selectedMetricKey });
    if (rangeMode === "custom" && appliedRange) {
      params.set("from", appliedRange.from);
      params.set("to", appliedRange.to);
    } else {
      params.set("granularity", rangeMode);
    }
    const url = `/api/admin/user-stats?${params.toString()}`;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ granularity: Granularity; points: Point[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setEffectiveGranularity(data.granularity);
        setPoints(data.points ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "שגיאה");
        setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appliedRange, rangeMode, selectedMetricKey]);

  const chartData = points.map((p) => ({
    ...p,
    label: formatBucket(p.bucket, effectiveGranularity),
  }));

  function toggleMetric(metric: Metric) {
    setSelectedMetrics((current) => {
      if (current.has(metric) && current.size === 1) return current;
      const next = new Set(current);
      if (next.has(metric)) next.delete(metric);
      else next.add(metric);
      return next;
    });
  }

  return (
    <div className="rounded border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">פעילות לאורך זמן</h2>
        <div className="flex flex-wrap gap-2">
          <MetricToggleGroup selected={selectedMetrics} onToggle={toggleMetric} />
          <SegmentedControl
            ariaLabel="טווח זמן"
            options={RANGES}
            value={rangeMode}
            onChange={setRangeMode}
          />
        </div>
      </div>

      {rangeMode === "custom" && (
        <div className="flex flex-wrap items-end gap-3 rounded border bg-background p-3" dir="rtl">
          <label className="grid gap-1 text-xs font-medium">
            מתאריך
            <input
              type="date"
              value={fromDate}
              max={toDate || today}
              onChange={(event) => setFromDate(event.target.value)}
              className="h-9 rounded border bg-background px-2 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            עד תאריך
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              max={today}
              onChange={(event) => setToDate(event.target.value)}
              className="h-9 rounded border bg-background px-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={!rangeIsValid}
            onClick={() => setAppliedRange({ from: fromDate, to: toDate })}
            className="h-9 rounded bg-slate-900 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            החל
          </button>
          {!rangeIsValid && (
            <span className="pb-2 text-xs text-red-600 dark:text-red-400">
              יש לבחור טווח תאריכים תקין עד היום
            </span>
          )}
        </div>
      )}

      <div className="h-72 w-full" dir="ltr">
        {error ? (
          <div className="flex h-full items-center justify-center text-sm text-red-600 dark:text-red-400">
            שגיאה בטעינת הנתונים: {error}
          </div>
        ) : loading && chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            טוען…
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            אין נתונים להצגה
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                {selectedMetricList.map((metric) => (
                  <linearGradient key={metric} id={`userActivityFill-${metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={METRIC_STYLES[metric].color} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={METRIC_STYLES[metric].color} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted-foreground/20" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
                minTickGap={20}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value, name) => [
                  typeof value === "number" ? value : Number(value ?? 0),
                  METRIC_LABELS[name as Metric] ?? String(name),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {selectedMetricList.map((metric) => (
                <Area
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  name={METRIC_LABELS[metric]}
                  stroke={METRIC_STYLES[metric].color}
                  strokeDasharray={METRIC_STYLES[metric].dash}
                  strokeWidth={2}
                  fill={`url(#userActivityFill-${metric})`}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function MetricToggleGroup({
  selected,
  onToggle,
}: {
  selected: ReadonlySet<Metric>;
  onToggle: (metric: Metric) => void;
}) {
  return (
    <div role="group" aria-label="מדדים" className="inline-flex flex-wrap rounded border bg-background p-0.5">
      {METRICS.map((metric) => {
        const active = selected.has(metric.id);
        const isOnlySelection = active && selected.size === 1;
        return (
          <button
            key={metric.id}
            type="button"
            aria-pressed={active}
            aria-disabled={isOnlySelection}
            onClick={() => onToggle(metric.id)}
            className={
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors " +
              (active
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: METRIC_STYLES[metric.id].color }}
            />
            {metric.label}
          </button>
        );
      })}
    </div>
  );
}

function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded border bg-background p-0.5">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.id)}
            className={
              "rounded px-2.5 py-1 text-xs font-medium transition-colors " +
              (active
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
