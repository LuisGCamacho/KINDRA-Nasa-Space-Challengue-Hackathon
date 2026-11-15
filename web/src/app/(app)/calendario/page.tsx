import { Suspense } from "react";
import { isYearMonth } from "@/lib/period";
import { CalendarScreen } from "@/components/calendar/CalendarScreen";

type CalendarioParams = PageProps<"/calendario">["searchParams"];

/**
 * Calendario mes × año, 2001–2026. `?mes=YYYY-MM` llega desde el botón de la lupa.
 * Con `cacheComponents`, lo que lee `searchParams` tiene que ir dentro de `<Suspense>`.
 */
export default function CalendarioPage({ searchParams }: PageProps<"/calendario">) {
  return (
    <Suspense fallback={<CalendarScreen initialMonth={null} />}>
      <CalendarWithMonth searchParams={searchParams} />
    </Suspense>
  );
}

async function CalendarWithMonth({ searchParams }: { searchParams: CalendarioParams }) {
  const { mes } = await searchParams;
  return <CalendarScreen initialMonth={typeof mes === "string" && isYearMonth(mes) ? mes : null} />;
}
