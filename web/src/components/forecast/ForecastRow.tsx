"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useZone } from "@/hooks/queries";
import { num } from "@/lib/format";
import type { ZoneForecast } from "@/lib/types";
import { ProbabilityBar } from "./ProbabilityBar";

const TREND = {
  sube: { label: "Sube", Icon: ArrowUpRight },
  estable: { label: "Estable", Icon: ArrowRight },
  baja: { label: "Baja", Icon: ArrowDownRight },
} as const;

/** Una zona del pronóstico: probabilidad, celdas con fuego esperadas y tendencia. */
export function ForecastRow({ forecast }: { forecast: ZoneForecast }) {
  const zone = useZone(forecast.zoneId);
  const { label, Icon } = TREND[forecast.trend];
  const [low, high] = forecast.expected;

  return (
    <tr>
      <td className="py-3 pr-4">
        <span className="block">{zone?.name ?? forecast.zoneId}</span>
        {zone?.parent && <span className="text-[12px] text-muted">{zone.parent}</span>}
      </td>
      <td className="py-3 pr-4"><ProbabilityBar p={forecast.p} /></td>
      <td className="py-3 pr-4 tabular-nums">{num(low)} a {num(high)}</td>
      <td className="py-3 pr-4">
        <span className="inline-flex items-center gap-1 text-muted">
          <Icon aria-hidden className="size-4" />
          {label}
        </span>
      </td>
    </tr>
  );
}
