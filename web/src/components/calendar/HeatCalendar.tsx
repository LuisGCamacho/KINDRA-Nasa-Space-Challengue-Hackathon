import { useMemo } from "react";
import type { MonthRow, YearMonth } from "@/lib/types";
import type { SeriesMode } from "@/store/useLensStore";
import { toYearMonth } from "@/lib/period";
import { MONTHS_SHORT } from "@/lib/format";
import { CalendarCell } from "./CalendarCell";

const FIRST_YEAR = 2001;
/** Último año con solo MODIS: VIIRS empieza en enero de 2012. */
const LAST_MODIS_ONLY_YEAR = 2011;

interface HeatCalendarProps {
  months: MonthRow[];
  series: SeriesMode;
  selected: YearMonth;
  onPick: (month: YearMonth) => void;
}

/** Grilla mes × año. El color es lineal sobre valor / máximo de toda la grilla. */
export function HeatCalendar({ months, series, selected, onPick }: HeatCalendarProps) {
  const byMonth = useMemo(() => new Map(months.map((row) => [row.t, row])), [months]);
  const max = useMemo(() => Math.max(0, ...months.map((row) => row[series])), [months, series]);

  const lastYear = Number(months.at(-1)?.t.slice(0, 4) ?? FIRST_YEAR);
  const years = Array.from({ length: lastYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

  return (
    <table className="border-separate border-spacing-1 text-[11px]">
      <thead>
        <tr>
          <th scope="col" />
          {MONTHS_SHORT.map((name) => (
            <th key={name} scope="col" className="font-normal text-muted">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
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
                    onPick={onPick}
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
