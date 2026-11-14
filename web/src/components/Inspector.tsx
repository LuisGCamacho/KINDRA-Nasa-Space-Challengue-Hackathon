import type { InspectorData, Settings } from "@/lib/types";
import { MONTHS_SHORT, monthLabel, monthName, num, pct, ratio } from "@/lib/format";
import { cx } from "@/lib/cx";
import { LABEL, LevelBadge } from "./ui";

const VERDICT = { "muy-alto": "más fuego que lo normal", alto: "más fuego que lo normal", normal: "dentro de lo normal", bajo: "menos fuego que lo normal" } as const;

export function Inspector({ d, units }: { d: InspectorData; units: Settings["unidades"] }) {
  const month = Number(d.mes.split("-")[1]) - 1;
  const year = Number(d.mes.split("-")[0]);
  const area = units === "ha" ? `${num(d.zone.areaKm2 * 100)} ha` : `${num(d.zone.areaKm2)} km²`;
  const max = Math.max(1, ...d.byYear.map((p) => p.value ?? 0));
  const metrics: [string, string][] = [
    ["Focos detectados", num(d.focos)],
    ["Normal (mediana)", num(d.mediana, 1)],
    ["Promedio plurianual", num(d.promedio, 1)],
    ["Diferencia vs. promedio", pct(d.diffPct)],
    ["Supera a", `${num(d.superaPct)} % de los años`],
    ["Incertidumbre", `±${d.incertidumbrePct} %`],
    ["Sensor", d.sensor],
  ];
  return (
    <aside className="w-full shrink-0 border-t border-border lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0">
      <div className="border-b border-border p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">{d.zone.name}</h2>
            <p className="text-xs text-muted-foreground">{d.zone.kind} · {d.zone.province} · {area}</p>
          </div>
          <LevelBadge level={d.level} />
        </div>
        <p className="mt-5 text-[44px] font-semibold leading-none">{ratio(d.ratio)}</p>
        <p className="mt-2 text-[13px] font-medium">{VERDICT[d.level]} para {monthName(d.mes)}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {monthLabel(d.mes)} comparado con la mediana del mismo mes en {d.yearsCompared} años {year === d.byYear.at(-1)?.year ? "anteriores" : "del registro"}.
        </p>
      </div>
      <div className="border-b border-border p-5">
        <h3 className={cx(LABEL, "mb-2")}>Métricas</h3>
        <dl>
          {metrics.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-dotted border-border py-2 last:border-0">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="p-5">
        <h3 className={LABEL}>{MONTHS_SHORT[month]}, año por año</h3>
        <div className="relative mt-3 flex h-32 items-end gap-px" role="img" aria-label={`Focos de ${monthName(d.mes)} de cada año, de 2001 a ${d.byYear.at(-1)?.year}`}>
          {d.byYear.map((p) => (
            <div key={p.year} className={cx("flex-1", p.year === year ? "bg-fire" : "bg-border")} style={{ height: `${((p.value ?? 0) / max) * 100}%` }} />
          ))}
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-faint" style={{ bottom: `${(d.mediana / max) * 100}%` }} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10.5px] text-faint">
          <span>{d.byYear[0].year}</span>
          <span>{d.byYear.at(-1)?.year}</span>
        </div>
      </div>
    </aside>
  );
}
