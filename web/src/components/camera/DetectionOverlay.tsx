import type { Box, FireRegion, NearbyMaterial } from "@/lib/alert-types";
import { FIRE_LABEL_COLOR, MATERIAL_COLOR, MATERIAL_NAME } from "@/lib/colors";
import { FIRE_LABEL_NAME, formatConfidence } from "@/lib/detection-text";

/**
 * Recuadros sobre la imagen. Los de fuego llevan etiqueta y confianza;
 * los materiales van punteados y en otro color para no confundirse con el fuego.
 */
export function DetectionOverlay({ regions, materials }: { regions: FireRegion[]; materials: NearbyMaterial[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {materials.map((material, i) =>
        material.box ? (
          <MarkedBox
            key={`material-${i}`}
            box={material.box}
            color={MATERIAL_COLOR}
            label={MATERIAL_NAME[material.label]}
            dashed
          />
        ) : null,
      )}
      {regions.map((region, i) => (
        <MarkedBox
          key={region.trackId ?? `region-${i}`}
          box={region.box}
          color={FIRE_LABEL_COLOR[region.label]}
          label={`${FIRE_LABEL_NAME[region.label]} · ${formatConfidence(region.confidence)}`}
        />
      ))}
    </div>
  );
}

interface MarkedBoxProps {
  box: Box;
  color: string;
  label: string;
  dashed?: boolean;
}

/** Un recuadro con su etiqueta arriba. Las medidas van en % porque el recuadro está normalizado. */
function MarkedBox({ box, color, label, dashed = false }: MarkedBoxProps) {
  return (
    <div
      className="absolute rounded-[3px]"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
        border: `2px ${dashed ? "dashed" : "solid"} ${color}`,
      }}
    >
      <span
        className="absolute -top-5 left-0 whitespace-nowrap rounded-[3px] px-1.5 text-[10.5px] font-medium leading-4 tabular-nums text-black"
        style={{ backgroundColor: color }}
      >
        {label}
      </span>
    </div>
  );
}
