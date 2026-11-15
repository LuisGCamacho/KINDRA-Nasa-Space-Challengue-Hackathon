"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { YearMonth } from "@/lib/types";
import { useLensStore } from "@/store/useLensStore";
import { useSeries, useZone } from "@/hooks/queries";
import { HeatCalendar } from "./HeatCalendar";
import { CalendarLegend } from "./CalendarLegend";

/** Pantalla del calendario: elegir un mes lo lleva a la lupa. */
export function CalendarScreen({ initialMonth }: { initialMonth: YearMonth | null }) {
  const router = useRouter();
  const zoneId = useLensStore((state) => state.zoneId);
  const month = useLensStore((state) => state.month);
  const series = useLensStore((state) => state.series);
  const setMonth = useLensStore((state) => state.setMonth);
  const zone = useZone(zoneId);
  const { data } = useSeries(zoneId);

  useEffect(() => {
    if (initialMonth) setMonth(initialMonth);
  }, [initialMonth, setMonth]);

  const pick = (picked: YearMonth) => {
    setMonth(picked);
    router.push("/explorar");
  };

  return (
    <section className="py-6">
      <h1 className="mb-1 text-[22px] font-medium tracking-[-0.02em]">Calendario · {zone?.name ?? "…"}</h1>
      <p className="mb-5 text-[13px] text-muted">
        Celdas-día por mes. Toca un mes para verlo en la lupa. Los años 2001–2011 solo tienen MODIS.
      </p>
      <div className="glass overflow-x-auto rounded-[22px] p-5">
        {data ? <HeatCalendar months={data.months} series={series} selected={month} onPick={pick} /> : "Cargando…"}
      </div>
      <div className="mt-4">
        <CalendarLegend />
      </div>
    </section>
  );
}
