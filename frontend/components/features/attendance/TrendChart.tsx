"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { LEVEL_COLOR, monthLabel } from "./attendance-utils";

interface Props {
  trend: { month: string; percentage: number | null }[];
  title?: string;
  description?: string;
  height?: number;
}

/** Monthly attendance % with the 75% threshold marked. Months without data leave a gap. */
export function TrendChart({ trend, title = "Last 6 months", description = "Monthly attendance percentage", height = 240 }: Props) {
  const data = trend.map((t) => ({ label: monthLabel(t.month), value: t.percentage }));
  return (
    <ChartCard title={title} description={description} height={height}>
      <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tickLine={false} />
        <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} />
        <Tooltip formatter={(v) => (v == null ? "No data" : `${v}%`)} />
        <ReferenceLine y={75} stroke={LEVEL_COLOR.risk} strokeDasharray="4 4" label={{ value: "75%", position: "insideTopRight", fontSize: 11 }} />
        <Line type="monotone" dataKey="value" name="Attendance" stroke="#c96442" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
      </LineChart>
    </ChartCard>
  );
}
