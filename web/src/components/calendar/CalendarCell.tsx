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
  /** No cumple el filtro de nivel: se atenúa pero sigue en su lugar y se puede tocar. */
  dimmed: boolean;
  onPick: (month: YearMonth) => void;
  /** Mes bajo el cursor o con el foco del teclado; `null` al salir. */
  onPreview: (month: YearMonth | null) => void;
}

/**
 * Un mes del calendario. Sin dato: borde punteado. Elegido: contorno blanco de 2 px.
 * Provisional (datos NRT que FIRMS todavía no reemplazó por los definitivos): un punto blanco.
 */
export function CalendarCell({ month, row, series, max, modisOnly, selected, dimmed, onPick, onPreview }: CalendarCellProps) {
  if (!row) {
    return <span aria-label={`${monthLabel(month)}: sin datos`} className="block h-6 w-full rounded-[4px] border border-dashed border-line" />;
  }

  const value = row[series];
  return (
    <button
      type="button"
      onClick={() => onPick(month)}
      onMouseEnter={() => onPreview(month)}
      onMouseLeave={() => onPreview(null)}
      onFocus={() => onPreview(month)}
      onBlur={() => onPreview(null)}
      aria-pressed={selected}
      aria-label={`${monthLabel(month)}: ${num(value)} celdas-día${row.partial ? ", provisorio" : ""}`}
      className={`relative block h-6 w-full rounded-[4px] transition-opacity hover:outline-1 hover:outline-offset-1 hover:outline-white/60 ${
        modisOnly ? "modis-hatch" : ""
      } ${dimmed ? "opacity-20" : ""} ${selected ? "outline-2 outline-offset-1 outline-white" : ""}`}
      style={{ backgroundColor: HEAT_RAMP[heatIndex(value, max)] }}
    >
      {row.partial && <span aria-hidden className="absolute right-1 top-1 size-1.5 rounded-full bg-inverse" />}
    </button>
  );
}
