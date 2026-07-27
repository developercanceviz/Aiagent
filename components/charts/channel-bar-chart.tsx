"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { channelDaily as defaultDaily } from "@/lib/mock/dashboard";

export function ChannelBarChart({
  data = defaultDaily,
}: {
  data?: typeof defaultDaily;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }} barCategoryGap="28%">
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
          cursor={{ fill: "rgba(0,0,0,0.03)" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e4e4e7",
            fontSize: 12,
          }}
        />
        <Bar dataKey="instagram" stackId="a" fill="var(--color-instagram)" />
        <Bar dataKey="messenger" stackId="a" fill="var(--color-messenger)" />
        <Bar dataKey="whatsapp" stackId="a" fill="var(--color-whatsapp)" />
        <Bar dataKey="webchat" stackId="a" fill="var(--color-webchat)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
