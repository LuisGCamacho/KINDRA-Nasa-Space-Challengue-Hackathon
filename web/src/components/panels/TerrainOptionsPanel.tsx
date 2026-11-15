import { GlassPanel } from "@/components/ui/GlassPanel";

/** Lente 3D: de dónde salen el relieve y la imagen. Todo es abierto y sin clave. */
export function TerrainOptionsPanel() {
  return (
    <GlassPanel id="terreno" title="Terreno 3D" meta="MapLibre">
      <p className="text-[12.5px] leading-relaxed text-muted">
        Relieve de Terrain Tiles (AWS Open Data) con la imagen satelital Sentinel-2 sin nubes de EOX, sin clave ni costo.
        Encima, las celdas con fuego del mes elegido, con los colores del calendario.
      </p>
    </GlassPanel>
  );
}
