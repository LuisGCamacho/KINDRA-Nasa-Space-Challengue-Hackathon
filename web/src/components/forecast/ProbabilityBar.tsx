import { num } from "@/lib/format";

/** Probabilidad como barra y como número: la cifra siempre se lee, la barra solo ayuda a comparar. */
export function ProbabilityBar({ p }: { p: number }) {
  const percent = Math.round(p * 100);
  return (
    <span className="inline-flex items-center gap-2.5">
      <span aria-hidden className="h-1.5 w-24 overflow-hidden rounded-full bg-glass-strong">
        <span className="block h-full rounded-full bg-heading" style={{ width: `${percent}%` }} />
      </span>
      <span className="w-10 text-right tabular-nums">{num(percent)} %</span>
    </span>
  );
}
