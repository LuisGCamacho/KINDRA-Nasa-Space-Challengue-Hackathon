import { num } from "@/lib/format";
import type { YearTotal } from "@/lib/yearly";

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };
const VIIRS_YEAR = 2012;

/** Línea SVG de una serie anual. */
function linePath(totals: YearTotal[], pick: (t: YearTotal) => number, x: (y: number) => number, y: (v: number) => number) {
  return totals.map((t, k) => `${k ? "L" : "M"}${x(t.year).toFixed(1)},${y(pick(t)).toFixed(1)}`).join(" ");
}

/**
 * Celdas-día por año: suma directa (gris) frente a armonizada (blanca). Si la armonización
 * funciona, el salto de 2012 aparece en la cruda y no en la armonizada.
 */
export function YearlyChart({ totals }: { totals: YearTotal[] }) {
  const first = totals[0].year;
  const last = totals.at(-1)!.year;
  const max = Math.max(...totals.map((t) => Math.max(t.raw, t.harm)), 1);
  const x = (year: number) => PAD.left + ((year - first) / Math.max(last - first, 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) => HEIGHT - PAD.bottom - (value / max) * (HEIGHT - PAD.top - PAD.bottom);

  return (
    <figure>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`Celdas-día por año de ${first} a ${last}, suma directa y armonizada`}>
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} className="stroke-line-soft" />
        <text x={PAD.left - 6} y={y(max) + 4} textAnchor="end" className="fill-muted text-[10px] tabular-nums">{num(max)}</text>
        {first <= VIIRS_YEAR && VIIRS_YEAR <= last && (
          <g>
            <line x1={x(VIIRS_YEAR)} x2={x(VIIRS_YEAR)} y1={PAD.top} y2={y(0)} strokeDasharray="3 3" className="stroke-line" />
            <text x={x(VIIRS_YEAR) + 4} y={PAD.top + 10} className="fill-muted text-[10px]">Llega VIIRS</text>
          </g>
        )}
        <path d={linePath(totals, (t) => t.raw, x, y)} fill="none" strokeWidth={1.5} className="stroke-muted" />
        <path d={linePath(totals, (t) => t.harm, x, y)} fill="none" strokeWidth={2} className="stroke-heading" />
        {[first, last].map((year) => (
          <text key={year} x={x(year)} y={HEIGHT - 6} textAnchor="middle" className="fill-muted font-mono text-[10px]">{year}</text>
        ))}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 bg-muted" />Suma directa</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 bg-heading" />Armonizada (escala MODIS)</span>
      </figcaption>
    </figure>
  );
}
