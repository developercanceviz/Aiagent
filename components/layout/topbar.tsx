"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BrandLogo } from "@/components/layout/brand-logo";

export function Topbar() {
  const router = useRouter();
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-card px-4">
      <button
        onClick={() => router.back()}
        aria-label="Geri"
        className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent"
      >
        <ArrowLeft className="size-4" />
      </button>
      <BrandLogo className="h-9" />
    </header>
  );
}
