import { useMemo } from "react";
import type { MonthRow, YearMonth } from "@/lib/types";
import type { SeriesMode } from "@/store/useLensStore";
import { toYearMonth } from "@/lib/period";
import { MONTHS_SHORT } from "@/lib/format";
import { CalendarCell } from "./CalendarCell";

/** Último año con solo MODIS: VIIRS empieza en enero de 2012. */
const LAST_MODIS_ONLY_YEAR = 2011;

interface HeatCalendarProps {
  months: MonthRow[];
  series: SeriesMode;
  selected: YearMonth;
  /** Primer y último año a mostrar (filtro de años). */
  firstYear: number;
  lastYear: number;
  /** Si el mes cumple el filtro de nivel; los que no, se atenúan. */
  highlighted: (month: YearMonth) => boolean;
  onPick: (month: YearMonth) => void;
  onPreview: (month: YearMonth | null) => void;
}

/**
 * Grilla mes × año. El color es lineal sobre valor / máximo de los años mostrados: al filtrar
 * desde 2012, la rampa se reparte entre esos años y no la aplasta un pico anterior. Las columnas
 * se reparten el ancho del panel (`table-fixed`): con celdas fijas de 24 px la grilla quedaba en
 * un rincón.
 */
export function HeatCalendar({ months, series, selected, firstYear, lastYear, highlighted, onPick, onPreview }: HeatCalendarProps) {
  const byMonth = useMemo(() => new Map(months.map((row) => [row.t, row])), [months]);
  const max = useMemo(() => {
    const shown = months.filter((row) => Number(row.t.slice(0, 4)) >= firstYear);
    return Math.max(0, ...shown.map((row) => row[series]));
  }, [months, series, firstYear]);

  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);

  return (
    <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-1 text-[11px]">
      <thead>
        <tr>
          <th scope="col" className="w-12" />
          {MONTHS_SHORT.map((name) => (
            <th key={name} scope="col" className="font-normal text-muted">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody onMouseLeave={() => onPreview(null)}>
        {years.map((year) => (
          <tr key={year}>
            <th scope="row" className="pr-2 text-right font-mono font-normal text-muted">
              {year}
            </th>
            {MONTHS_SHORT.map((_, index) => {
              const month = toYearMonth(year, index + 1);
              return (
                <td key={month}>
                  <CalendarCell
                    month={month}
                    row={byMonth.get(month) ?? null}
                    series={series}
                    max={max}
                    modisOnly={year <= LAST_MODIS_ONLY_YEAR}
                    selected={month === selected}
                    dimmed={!highlighted(month)}
                    onPick={onPick}
                    onPreview={onPreview}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
