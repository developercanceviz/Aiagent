import { Camera, MessageCircle, Phone, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";

export type ChannelKind = "instagram" | "whatsapp" | "messenger" | "webchat";

const config: Record<
  ChannelKind,
  { icon: typeof Camera; className: string }
> = {
  instagram: {
    icon: Camera,
    className: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white",
  },
  whatsapp: { icon: Phone, className: "bg-[#25d366]/12 text-[#1faa53]" },
  messenger: { icon: MessageCircle, className: "bg-[#0084ff]/12 text-[#0084ff]" },
  webchat: { icon: MessageSquare, className: "bg-primary/15 text-brand-700" },
};

export function ChannelIcon({
  kind,
  className,
  size = "md",
}: {
  kind: ChannelKind;
  className?: string;
  size?: "sm" | "md";
}) {
  const { icon: Icon, className: tone } = config[kind];
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl",
        size === "sm" ? "size-7" : "size-10",
        tone,
        className
      )}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-5"} />
    </div>
  );
}
