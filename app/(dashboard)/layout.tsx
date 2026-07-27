import { AppBridgeProvider } from "@/components/ikas/app-bridge-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppBridgeProvider>
      <DashboardShell>{children}</DashboardShell>
    </AppBridgeProvider>
  );
}
