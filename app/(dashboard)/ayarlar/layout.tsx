import { SettingsNav } from "@/components/settings/settings-nav";

export default function AyarlarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <SettingsNav />
      {children}
    </div>
  );
}
