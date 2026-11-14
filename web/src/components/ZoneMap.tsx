import { Crosshair, Minus, Plus } from "lucide-react";

type Hotspot = { u: number; v: number };

/*
  Mapa de ejemplo en SVG. Cuando tengas coordenadas reales de FIRMS, cambia este
  componente por MapLibre o Leaflet y conserva las mismas props y el mismo contenedor.
*/
export function ZoneMap({ zoneName, hotspots }: { zoneName: string; hotspots: Hotspot[] }) {
  const ctl = "grid h-8 w-8 place-items-center hover:bg-hover";
  return (
    <div className="relative h-[300px] shrink-0 bg-stage lg:h-[46%] lg:min-h-[280px]">
      <svg viewBox="0 0 860 380" className="h-full w-full" role="img" aria-label={`Mapa de ${zoneName} con ${hotspots.length} focos de calor`}>
        <path d="M60 40 L420 12 L690 38 L800 150 L790 330 L330 372 L70 330 Z" fill="#fff" stroke="var(--color-border)" />
        <path d="M418 28 L459 77 M612 121 L790 160 M468 308 L325 372" fill="none" stroke="var(--color-border)" />
        <polygon
          points="272,77 459,77 612,121 635,252 468,308 290,275"
          fill="none"
          stroke="var(--color-foreground)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <text x="288" y="104" fontSize="14" fill="var(--color-foreground)">
          {zoneName}
        </text>
        {hotspots.map((h, i) => {
          const r = Math.sqrt(h.u) * 0.9; // reparte los puntos dentro de la zona
          const a = h.v * 2 * Math.PI;
          return <circle key={i} cx={455 + Math.cos(a) * r * 150} cy={190 + Math.sin(a) * r * 95} r="5" fill="var(--color-fire)" fillOpacity=".6" />;
        })}
      </svg>
      <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-md border border-border bg-background">
        <button type="button" className={ctl} aria-label="Acercar"><Plus size={16} strokeWidth={1.75} /></button>
        <button type="button" className={`${ctl} border-t border-border`} aria-label="Alejar"><Minus size={16} strokeWidth={1.75} /></button>
        <button type="button" className={`${ctl} border-t border-border`} aria-label="Centrar en la zona"><Crosshair size={16} strokeWidth={1.75} /></button>
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-4 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-fire/60" aria-hidden /> Foco de calor
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-foreground" aria-hidden /> Zona
        </span>
      </div>
    </div>
  );
}
