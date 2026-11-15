import { GlassPanel } from "@/components/ui/GlassPanel";

/** Lente 3D: de dónde sale la imagen y cuánto cuesta abrirla. */
export function TerrainOptionsPanel() {
  return (
    <GlassPanel id="terreno" title="Terreno 3D" meta="Google 3D Tiles">
      <p className="text-[12.5px] leading-relaxed text-muted">
        Relieve y edificios fotorrealistas de Google, dibujados con CesiumJS. Cada vez que se abre esta lente se usa una
        sesión de la cuota gratuita (1.000 por mes). Los créditos de Google se muestran abajo de la lente.
      </p>
    </GlassPanel>
  );
}
