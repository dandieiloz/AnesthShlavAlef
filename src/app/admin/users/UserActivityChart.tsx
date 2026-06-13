"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Metric = "active" | "attempts" | "signups" | "visits" | "visitors";
type Granularity = "hour" | "day" | "month";

type Point = { bucket: string; value: number };

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
  const [metric, setMetric] = useState<Metric>("attempts");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = `/api/admin/user-stats?metric=${metric}&granularity=${granularity}`;
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ points: Point[] }>;
      })
      .then((data) => {
        if (cancelled) return;
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
  }, [metric, granularity]);

  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? "";
  const chartData = points.map((p) => ({
    ...p,
    label: formatBucket(p.bucket, granularity),
  }));

  return (
    <div className="rounded border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">פעילות לאורך זמן</h2>
        <div className="flex flex-wrap gap-2">
          <SegmentedControl
            ariaLabel="מדד"
            options={METRICS}
            value={metric}
            onChange={setMetric}
          />
          <SegmentedControl
            ariaLabel="טווח זמן"
            options={GRANULARITIES}
            value={granularity}
            onChange={setGranularity}
          />
        </div>
      </div>

      <div className="h-64 w-full" dir="ltr">
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
                <linearGradient id="userActivityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0.02} />
                </linearGradient>
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
                formatter={(v) => [typeof v === "number" ? v : Number(v ?? 0), metricLabel]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(217 91% 60%)"
                strokeWidth={2}
                fill="url(#userActivityFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
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
