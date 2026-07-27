"use client";

import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAppBridge } from "@/components/ikas/app-bridge-provider";

/**
 * App shell. When embedded in the ikas admin panel the surrounding chrome is
 * already ikas' own, so our topbar is dropped to avoid a doubled header — the
 * sidebar stays, since it navigates within our app.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const { embedded } = useAppBridge();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {!embedded && <Topbar />}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto p-3 pl-0">
          <div className="h-full rounded-2xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
