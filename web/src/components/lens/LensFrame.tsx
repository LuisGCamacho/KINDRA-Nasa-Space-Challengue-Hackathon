import type { ReactNode } from "react";

/**
 * Aro de la lupa. El borde interior y el halo toman el color de la fase del fuego,
 * así el nivel se ve sin leer nada (y el panel de Diagnóstico lo dice con palabras).
 */
export function LensFrame({ color, children }: { color: string; children: ReactNode }) {
  return (
    <div
      className="relative aspect-square w-full"
      style={{ maxWidth: "min(600px, calc(100dvh - 230px))", minWidth: "min(100%, 300px)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[6%] rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: color }}
      />
      <div className="glass relative size-full rounded-full p-2.5">
        <div
          className="relative size-full overflow-hidden rounded-full bg-base"
          style={{ boxShadow: `0 0 0 1.5px ${color}, 0 0 28px ${color}55` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
