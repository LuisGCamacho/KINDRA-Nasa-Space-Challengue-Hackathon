import type { Level } from "@/lib/types";
import { LEVEL_COLOR } from "@/lib/colors";

const LEVELS: Level[] = ["Bajo", "Normal", "Alto", "Muy alto"];

/** Leyenda de las cuatro fases, siempre con su palabra. */
export function LensLegend() {
  return (
    <ul
      aria-label="Niveles"
      className="glass inline-flex h-9 flex-wrap items-center justify-center gap-x-4 rounded-full px-4 text-[12px] text-muted"
    >
      {LEVELS.map((level) => (
        <li key={level} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ backgroundColor: LEVEL_COLOR[level], boxShadow: `0 0 8px ${LEVEL_COLOR[level]}` }}
          />
          {level}
        </li>
      ))}
    </ul>
  );
}
