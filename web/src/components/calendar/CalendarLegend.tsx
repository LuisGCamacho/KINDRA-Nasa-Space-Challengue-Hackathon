import { HEAT_RAMP } from "@/lib/colors";

/** Rampa del calendario de menos a más fuego, con las dos marcas especiales. */
export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
      <span className="inline-flex items-center gap-1.5">
        Menos
        {HEAT_RAMP.map((color) => (
          <span key={color} aria-hidden className="size-3 rounded-[3px]" style={{ backgroundColor: color }} />
        ))}
        Más
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="modis-hatch size-3 rounded-[3px] bg-[#4A3A1E]" />
        Solo MODIS
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="relative size-3 rounded-[3px] bg-[#4A3A1E]">
          <span className="absolute right-0.5 top-0.5 size-1 rounded-full bg-inverse" />
        </span>
        Provisorio (FIRMS NRT)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-[3px] border border-dashed border-line" />
        Sin datos
      </span>
    </div>
  );
}
