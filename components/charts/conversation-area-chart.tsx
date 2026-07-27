"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { conversationSeries as defaultSeries } from "@/lib/mock/dashboard";

export function ConversationAreaChart({
  data = defaultSeries,
}: {
  data?: typeof defaultSeries;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fillSohbet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14daaa" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#14daaa" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          width={36}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e4e4e7",
            fontSize: 12,
            boxShadow: "0 4px 16px -8px rgb(0 0 0 / 0.15)",
          }}
        />
        <Area
          type="monotone"
          dataKey="sohbet"
          stroke="#14daaa"
          strokeWidth={2.5}
          fill="url(#fillSohbet)"
        />
        <Area
          type="monotone"
          dataKey="ai"
          stroke="#0084ff"
          strokeWidth={2}
          fillOpacity={0}
        />
        <Area
          type="monotone"
          dataKey="canli"
          stroke="#e1306c"
          strokeWidth={2}
          fillOpacity={0}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
