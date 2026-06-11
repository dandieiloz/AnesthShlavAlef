"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type HospitalSlice = { name: string; value: number };

const COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#84cc16", // lime
  "#94a3b8", // slate (Other / No hospital)
];

/** Trim long Hebrew hospital names for on-slice labels (e.g. "בית חולים השרון" → "השרון"). */
function shortLabel(name: string): string {
  if (name.includes("איכילוב")) return "איכילוב";
  return name
    .replace(/^המרכז הרפואי השיקומי\s+/, "")
    .replace(/^המרכז הרפואי\s+/, "")
    .replace(/^מרכז רפואי\s+/, "")
    .replace(/^מרכז\s+/, "")
    .replace(/^בית החולים\s+/, "")
    .replace(/^בית חולים\s+/, "")
    .replace(/^בית\s+/, "")
    .trim();
}

export function HospitalPieChart({
  data,
  questionsLabel,
}: {
  data: HospitalSlice[];
  questionsLabel: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div dir="ltr" className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="95%"
            paddingAngle={1}
            label={({ name, value, percent }) =>
              percent !== undefined && percent >= 0.06
                ? `${shortLabel(name as string)} ${value}`
                : ""
            }
            labelLine={false}
            fontSize={11}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const num = Number(value) || 0;
              const pct = total > 0 ? Math.round((num / total) * 100) : 0;
              return [`${num} ${questionsLabel} (${pct}%)`, name];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
