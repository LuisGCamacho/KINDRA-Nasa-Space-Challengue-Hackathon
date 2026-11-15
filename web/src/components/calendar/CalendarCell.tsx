import type { MonthRow, YearMonth } from "@/lib/types";
import type { SeriesMode } from "@/store/useLensStore";
import { HEAT_RAMP, heatIndex } from "@/lib/colors";
import { monthLabel, num } from "@/lib/format";

interface CalendarCellProps {
  month: YearMonth;
  /** `null` si el mes no tiene dato. */
  row: MonthRow | null;
  series: SeriesMode;
  max: number;
  /** Años 2001–2011: solo MODIS, se marcan con rayado. */
  modisOnly: boolean;
  selected: boolean;
  onPick: (month: YearMonth) => void;
}

/** Un mes del calendario. Sin dato: borde punteado. Elegido: contorno blanco de 2 px. */
export function CalendarCell({ month, row, series, max, modisOnly, selected, onPick }: CalendarCellProps) {
  if (!row) {
    return <span aria-label={`${monthLabel(month)}: sin datos`} className="block size-6 rounded-[4px] border border-dashed border-line" />;
  }

  const value = row[series];
  return (
    <button
      type="button"
      onClick={() => onPick(month)}
      aria-pressed={selected}
      aria-label={`${monthLabel(month)}: ${num(value)} celdas-día${row.partial ? ", provisorio" : ""}`}
      title={`${monthLabel(month)} · ${num(value)} celdas-día`}
      className={`block size-6 rounded-[4px] ${modisOnly ? "modis-hatch" : ""} ${
        selected ? "outline-2 outline-offset-1 outline-white" : ""
      }`}
      style={{ backgroundColor: HEAT_RAMP[heatIndex(value, max)] }}
    />
  );
}
