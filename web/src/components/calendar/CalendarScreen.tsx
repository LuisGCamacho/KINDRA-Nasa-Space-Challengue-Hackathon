"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { YearMonth } from "@/lib/types";
import { useLensStore } from "@/store/useLensStore";
import { useSeries, useZone } from "@/hooks/queries";
import { useMonthLevels } from "@/hooks/useMonthLevels";
import { HeatCalendar } from "./HeatCalendar";
import { CalendarLegend } from "./CalendarLegend";
import { CalendarFilters, firstYearOf, passesLevel, type LevelFilter, type YearRange } from "./CalendarFilters";
import { MonthDetail } from "./MonthDetail";

/** Primer año completo de MODIS Terra (la serie empieza en 2000-11). */
const FIRST_YEAR = 2001;

/**
 * Pantalla del calendario. Pasar el cursor por un mes muestra su detalle al costado; tocarlo lo
 * deja elegido, y el botón del detalle lo abre en la lupa.
 */
export function CalendarScreen({ initialMonth }: { initialMonth: YearMonth | null }) {
  const router = useRouter();
  const zoneId = useLensStore((state) => state.zoneId);
  const month = useLensStore((state) => state.month);
  const series = useLensStore((state) => state.series);
  const setMonth = useLensStore((state) => state.setMonth);
  const zone = useZone(zoneId);
  const { data } = useSeries(zoneId);
  const levels = useMonthLevels(data, series);

  const [range, setRange] = useState<YearRange>("todo");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("todos");
  const [preview, setPreview] = useState<YearMonth | null>(null);

  useEffect(() => {
    if (initialMonth) setMonth(initialMonth);
  }, [initialMonth, setMonth]);

  const lastYear = Number(data?.months.at(-1)?.t.slice(0, 4) ?? FIRST_YEAR);
  const firstYear = firstYearOf(range, FIRST_YEAR, lastYear);
  const shown = preview ?? month;
  const shownRow = data?.months.find((row) => row.t === shown) ?? null;

  const highlighted = (candidate: YearMonth) => {
    const result = levels.get(candidate);
    return passesLevel(levelFilter, result?.ok ? result.stats.level : null);
  };

  const openInLens = (picked: YearMonth) => {
    setMonth(picked);
    router.push("/explorar");
  };

  return (
    <section className="py-6">
      <h1 className="mb-1 text-[22px] font-medium tracking-[-0.02em]">Calendario · {zone?.name ?? "…"}</h1>
      <p className="mb-5 text-[13px] text-muted">
        Celdas-día por mes. Pasa el cursor por un mes para ver su detalle y tócalo para elegirlo. Los años 2001–2011
        solo tienen MODIS.
      </p>
      <CalendarFilters range={range} onRange={setRange} level={levelFilter} onLevel={setLevelFilter} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="glass overflow-x-auto rounded-[22px] p-5">
          {data ? (
            <HeatCalendar
              months={data.months}
              series={series}
              selected={month}
              firstYear={firstYear}
              lastYear={lastYear}
              highlighted={highlighted}
              onPick={setMonth}
              onPreview={setPreview}
            />
          ) : (
            "Cargando…"
          )}
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <MonthDetail month={shown} row={shownRow} result={levels.get(shown)} series={series} onOpen={openInLens} />
        </div>
      </div>
      <div className="mt-4">
        <CalendarLegend />
      </div>
    </section>
  );
}
