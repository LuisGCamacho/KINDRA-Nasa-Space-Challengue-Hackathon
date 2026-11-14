import { Page, PageHeader } from "@/components/ui";

/** Marcador: la pantalla todavía no tiene diseño. */
export default function PendingPage() {
  return (
    <>
      <PageHeader title="Reportes" />
      <Page>
        <p className="text-muted-foreground">Pendiente.</p>
      </Page>
    </>
  );
}
