import { isYearMonth } from "@/lib/period";
import { CalendarScreen } from "@/components/calendar/CalendarScreen";

/** Calendario mes × año, 2001–2026. `?mes=YYYY-MM` llega desde el botón de la lupa. */
export default async function CalendarioPage({ searchParams }: PageProps<"/calendario">) {
  const { mes } = await searchParams;
  return <CalendarScreen initialMonth={typeof mes === "string" && isYearMonth(mes) ? mes : null} />;
}
