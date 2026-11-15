import type { Level } from "@/lib/types";
import { LEVEL_COLOR } from "@/lib/colors";

/** Nivel en una píldora de vidrio: la palabra siempre, y una brasa con el color de su fase. */
export function LevelBadge({ level, compact = false }: { level: Level; compact?: boolean }) {
  const color = LEVEL_COLOR[level];
  return (
    <span
      className={`glass inline-flex items-center gap-2 whitespace-nowrap rounded-full ${
        compact ? "h-6 px-2.5 text-[11.5px]" : "h-7 px-3 text-[12.5px]"
      }`}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}33, 0 0 10px ${color}` }}
      />
      {level}
    </span>
  );
}
