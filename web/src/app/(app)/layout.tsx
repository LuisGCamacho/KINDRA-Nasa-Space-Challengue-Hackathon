import { Sidebar } from "@/components/Sidebar";
import { getAlerts } from "@/lib/data";
import { DEFAULT_SETTINGS } from "@/lib/view-types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const alerts = await getAlerts(DEFAULT_SETTINGS);
  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <Sidebar alertCount={alerts.length} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
