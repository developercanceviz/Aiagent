"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Renders AI reply text as markdown (bold, lists, tables) instead of showing
 * it raw. Without this, GPT's "**kalın metin**" shows as literal asterisks —
 * the model is doing its job, the bubble just wasn't interpreting it.
 * Customer messages are never markdown, so only pass this AI/HUMAN_AGENT text.
 */
export function ChatMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-2 overflow-x-auto whitespace-normal break-words",
        "[&_strong]:font-semibold [&_em]:italic",
        "[&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4",
        "[&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_a]:underline [&_a]:underline-offset-2",
        "[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-black/10 [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:text-left [&_td]:border [&_td]:border-black/10 [&_td]:px-1.5 [&_td]:py-0.5",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
