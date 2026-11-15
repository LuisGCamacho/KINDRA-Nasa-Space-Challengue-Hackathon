import type { Level } from "@/lib/types";
import { LEVEL_COLOR } from "@/lib/colors";

const PHASES: Level[] = ["Bajo", "Normal", "Alto", "Muy alto"];

/** Opacidad de cada fase: la actual encendida, las anteriores a media luz, las siguientes apagadas. */
function phaseOpacity(index: number, activeIndex: number): number {
  if (index === activeIndex) return 1;
  return index < activeIndex ? 0.45 : 0.16;
}

/** Las cuatro fases del fuego en una barra; se enciende la del nivel actual. */
export function PhaseMeter({ level }: { level: Level }) {
  const activeIndex = PHASES.indexOf(level);
  return (
    <div role="img" aria-label={`Fase ${activeIndex + 1} de 4: ${level}`}>
      <div className="grid grid-cols-4 gap-1">
        {PHASES.map((phase, index) => (
          <span
            key={phase}
            className="h-1.5 rounded-full"
            style={{
              backgroundColor: LEVEL_COLOR[phase],
              opacity: phaseOpacity(index, activeIndex),
              boxShadow: index === activeIndex ? `0 0 12px ${LEVEL_COLOR[phase]}` : undefined,
            }}
          />
        ))}
      </div>
      <div aria-hidden className="mt-2 grid grid-cols-4 gap-1 text-[11px]">
        {PHASES.map((phase, index) => (
          <span key={phase} className={index === activeIndex ? "text-heading" : "text-muted/70"}>
            {phase}
          </span>
        ))}
      </div>
    </div>
  );
}
