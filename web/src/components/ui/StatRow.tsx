import type { ReactNode } from "react";

interface StatRowProps {
  label: string;
  value: ReactNode;
  /** Contexto corto junto a la etiqueta, por ejemplo la unidad. */
  hint?: string;
}

/** Fila de dato: etiqueta a la izquierda, cifra a la derecha, separadas por una línea fina. */
export function StatRow({ label, value, hint }: StatRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line-soft py-2.5 first:border-t-0">
      <dt className="text-[12.5px] text-muted">
        {label}
        {hint && <span className="text-muted/60"> · {hint}</span>}
      </dt>
      <dd className="text-right text-[13px] tabular-nums">{value}</dd>
    </div>
  );
}
