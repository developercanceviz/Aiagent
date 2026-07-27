"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { channelDistribution as defaultDist } from "@/lib/mock/dashboard";

export function ChannelDonut({
  data = defaultDist,
}: {
  data?: typeof defaultDist;
}) {
  const channelDistribution = data;
  const total = channelDistribution.reduce((s, c) => s + c.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={channelDistribution}
            dataKey="value"
            nameKey="name"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={3}
            cornerRadius={6}
            stroke="none"
          >
            {channelDistribution.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-foreground">{total}</span>
        <span className="text-xs text-muted-foreground">Konuşma</span>
      </div>
    </div>
  );
}

export function ChannelLegend({ data = defaultDist }: { data?: typeof defaultDist }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {data.map((c) => (
        <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
          {c.name}
        </div>
      ))}
    </div>
  );
}
