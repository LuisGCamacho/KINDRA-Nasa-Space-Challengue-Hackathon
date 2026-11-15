"use client";

import type { Level } from "@/lib/types";
import { useZones } from "@/hooks/queries";
import { useLensStore, type SeriesMode } from "@/store/useLensStore";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { PillSelect } from "@/components/ui/PillSelect";
import { Segmented, type SegmentOption } from "@/components/ui/Segmented";

/** Años que muestra la grilla. */
export type YearRange = "todo" | "viirs" | "diez";
/** Meses que quedan resaltados; el resto se atenúa sin desaparecer. */
export type LevelFilter = "todos" | "alto" | "muy-alto";

/** Primer año de VIIRS: desde 2012 la serie tiene los dos sensores. */
const FIRST_VIIRS_YEAR = 2012;
const LAST_YEARS = 10;

const SERIES_OPTIONS: SegmentOption<SeriesMode>[] = [
  { value: "harm", label: "Armonizada" },
  { value: "raw", label: "Cruda" },
];
const RANGE_OPTIONS: SegmentOption<YearRange>[] = [
  { value: "todo", label: "Todos" },
  { value: "viirs", label: "Desde 2012" },
  { value: "diez", label: "Últimos 10" },
];
const LEVEL_OPTIONS: SegmentOption<LevelFilter>[] = [
  { value: "todos", label: "Todos" },
  { value: "alto", label: "Alto o más" },
  { value: "muy-alto", label: "Muy alto" },
];

/** Primer año a mostrar según el rango elegido. */
export function firstYearOf(range: YearRange, firstYear: number, lastYear: number): number {
  if (range === "viirs") return Math.max(firstYear, FIRST_VIIRS_YEAR);
  if (range === "diez") return Math.max(firstYear, lastYear - LAST_YEARS + 1);
  return firstYear;
}

/** Si un mes con ese nivel queda resaltado. Sin nivel (sin historial) solo pasa con "Todos". */
export function passesLevel(filter: LevelFilter, level: Level | null): boolean {
  if (filter === "todos") return true;
  if (filter === "muy-alto") return level === "Muy alto";
  return level === "Alto" || level === "Muy alto";
}

interface CalendarFiltersProps {
  range: YearRange;
  onRange: (range: YearRange) => void;
  level: LevelFilter;
  onLevel: (level: LevelFilter) => void;
}

/**
 * Filtros del calendario. Zona y serie son las de la lupa (cambiarlas aquí también cambia la
 * lupa); años y nivel son solo de esta pantalla.
 */
export function CalendarFilters({ range, onRange, level, onLevel }: CalendarFiltersProps) {
  const zoneId = useLensStore((state) => state.zoneId);
  const series = useLensStore((state) => state.series);
  const setZone = useLensStore((state) => state.setZone);
  const setSeries = useLensStore((state) => state.setSeries);
  const { data: zones = [] } = useZones();

  return (
    <div className="mb-4 flex flex-wrap items-end gap-x-5 gap-y-3">
      <div className="w-full sm:w-56">
        <FieldLabel htmlFor="calendario-zona">Zona</FieldLabel>
        <PillSelect id="calendario-zona" value={zoneId} onChange={(event) => setZone(event.target.value)}>
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </PillSelect>
      </div>
      <div>
        <FieldLabel>Serie</FieldLabel>
        <Segmented label="Serie" value={series} options={SERIES_OPTIONS} onChange={setSeries} />
      </div>
      <div>
        <FieldLabel>Años</FieldLabel>
        <Segmented label="Años" value={range} options={RANGE_OPTIONS} onChange={onRange} />
      </div>
      <div>
        <FieldLabel>Nivel</FieldLabel>
        <Segmented label="Nivel" value={level} options={LEVEL_OPTIONS} onChange={onLevel} />
      </div>
    </div>
  );
}
