import { AppBackdrop } from "@/components/layout/AppBackdrop";
import { AppHeader } from "@/components/layout/AppHeader";
import { countActiveAlerts } from "@/server/fire-alerts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const alertCount = await countActiveAlerts();
  return (
    <>
      <AppBackdrop />
      <AppHeader alertCount={alertCount} />
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-6 sm:px-6">{children}</main>
    </>
  );
}
