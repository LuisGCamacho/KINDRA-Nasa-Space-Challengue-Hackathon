import Link from "next/link";
import type { Matrix } from "@/lib/view-types";
import { HEAT, heatClass } from "@/lib/colors";
import { MONTHS_SHORT, monthLabel } from "@/lib/format";
import { cx } from "@/lib/cx";

const GRID = "grid grid-cols-[32px_repeat(12,minmax(0,1fr))] gap-1";

/** Cada celda es un <Link>: elegir un mes = cambiar la URL, y el Inspector se actualiza solo. */
export function HeatCalendar({
  rows, max, firstYear, zonaId, zoneName, selected,
}: { rows: Matrix; max: number; firstYear: number; zonaId: string; zoneName: string; selected: string }) {
  const lastYear = firstYear + rows.length - 1;
  const years = rows.map((_, i) => firstYear + i).reverse(); // arriba, el año más reciente
  return (
    <section className="overflow-x-auto px-5 py-4">
      <div className="min-w-[640px]">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold">Calendario de quema · {zoneName}</h2>
          <p className="text-xs text-muted-foreground">Cada celda es un mes · clic para inspeccionar</p>
        </div>
        <div className={cx(GRID, "mb-1 text-center text-[11px] text-faint")} aria-hidden>
          <span />
          {MONTHS_SHORT.map((m) => <span key={m}>{m}</span>)}
        </div>
        {years.map((year) => (
          <div key={year} className={cx(GRID, "mb-1")}>
            <span className="font-mono text-[10.5px] text-faint">{year === lastYear || year % 5 === 0 ? year : ""}</span>
            {rows[year - firstYear].map((v, m) => {
              const ym = `${year}-${String(m + 1).padStart(2, "0")}`;
              if (v === null)
                return <span key={m} aria-label={`${monthLabel(ym)}: sin datos aún`} className="h-4 rounded-[3px] border border-dashed border-border" />;
              return (
                <Link
                  key={m}
                  href={`/explorar?zona=${zonaId}&mes=${ym}`}
                  scroll={false}
                  aria-label={`${monthLabel(ym)}: ${v} focos`}
                  aria-current={ym === selected ? "true" : undefined}
                  style={{ backgroundColor: HEAT[heatClass(v, max)] }}
                  className={cx("h-4 rounded-[3px]", year <= 2011 && "hatch", ym === selected && "outline outline-2 outline-foreground")}
                />
              );
            })}
          </div>
        ))}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            Menos
            {HEAT.map((c) => <span key={c} className="h-3 w-4 rounded-[3px]" style={{ backgroundColor: c }} aria-hidden />)}
            Más focos
          </span>
          <span className="flex items-center gap-1.5"><span className="hatch h-3 w-4 rounded-[3px] border border-border" aria-hidden /> Solo MODIS</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-[3px] border border-dashed border-border" aria-hidden /> Sin datos aún</span>
        </div>
      </div>
    </section>
  );
}
