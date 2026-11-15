import { Suspense } from "react";
import { AppBackdrop } from "@/components/layout/AppBackdrop";
import { AppHeader } from "@/components/layout/AppHeader";
import { countActiveAlerts } from "@/server/fire-alerts";

/**
 * El contador de alertas se lee del disco en cada pedido. Con `cacheComponents`, eso tiene que ir
 * dentro de `<Suspense>`: el encabezado sale al instante con 0 y el número llega después.
 */
async function HeaderWithAlertCount() {
  return <AppHeader alertCount={await countActiveAlerts()} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppBackdrop />
      <Suspense fallback={<AppHeader alertCount={0} />}>
        <HeaderWithAlertCount />
      </Suspense>
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-6 sm:px-6">{children}</main>
    </>
  );
}
