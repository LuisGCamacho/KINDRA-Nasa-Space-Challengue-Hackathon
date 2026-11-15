"use client";

import { useMemo } from "react";
import Map, { Layer, Source, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCells, useZone } from "@/hooks/queries";
import { useLensStore } from "@/store/useLensStore";
import { cellsToGeoJson } from "@/lib/geo";
import { num } from "@/lib/format";
import type { HoverInfo } from "../LensViewport";

/** Mapa base oscuro y libre. El propio mapa muestra el crédito a CARTO y OpenStreetMap. */
const BASEMAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const CELL_LAYER = "celdas";

/** Worker de MapLibre copiado a `public/` en la instalación (`scripts/copy-maplibre-worker.mjs`). */
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/** Lente 2D: las celdas con fuego del mes, con la misma rampa de color del calendario. */
export function MapLensView({ onHover }: { onHover: (info: HoverInfo | null) => void }) {
  const zoneId = useLensStore((state) => state.zoneId);
  const month = useLensStore((state) => state.month);
  const selectCell = useLensStore((state) => state.selectCell);
  const zone = useZone(zoneId);
  const { data: cellsMonth } = useCells(month);

  const cells = useMemo(() => cellsToGeoJson(cellsMonth?.cells ?? []), [cellsMonth]);

  if (!zone) return <p className="grid size-full place-items-center text-muted">Cargando zona…</p>;

  const handleHover = (event: MapLayerMouseEvent) => {
    const props = event.features?.[0]?.properties;
    onHover(props ? { title: `${num(props.cellDays)} celdas-día`, detail: `FRP máx. ${num(props.frpMax)} MW` } : null);
  };

  const handleClick = (event: MapLayerMouseEvent) => {
    const index = event.features?.[0]?.properties?.index;
    selectCell(index === undefined ? null : (cellsMonth?.cells[index] ?? null));
  };

  return (
    <Map
      key={zone.id}
      initialViewState={{ bounds: zone.bbox, fitBoundsOptions: { padding: 40 } }}
      mapStyle={BASEMAP}
      workerUrl={WORKER_URL}
      interactiveLayerIds={[CELL_LAYER]}
      onMouseMove={handleHover}
      onMouseLeave={() => onHover(null)}
      onClick={handleClick}
      style={{ width: "100%", height: "100%" }}
    >
      <Source id="celdas" type="geojson" data={cells}>
        <Layer
          id={CELL_LAYER}
          type="circle"
          paint={{
            "circle-color": ["get", "color"],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 2, 9, 9],
            "circle-opacity": 0.85,
          }}
        />
      </Source>
    </Map>
  );
}
