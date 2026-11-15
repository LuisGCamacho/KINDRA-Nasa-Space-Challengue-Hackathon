"use client";

import { useEffect, useMemo, useRef } from "react";
import Map, { Layer, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAlertHotspots, useCameras, useCells, useConfirmedFireAlert, useZone } from "@/hooks/queries";
import { useLensStore } from "@/store/useLensStore";
import { cellsToGeoJson } from "@/lib/geo";
import { hotspotsToGeoJson } from "@/lib/hotspots";
import { num } from "@/lib/format";
import type { HoverInfo } from "../LensViewport";
import { HotspotLayers, HOTSPOT_LAYERS } from "./HotspotLayers";

/** Mapa base oscuro y libre. El propio mapa muestra el crédito a CARTO y OpenStreetMap. */
const BASEMAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const CELL_LAYER = "celdas";

/** Worker de MapLibre copiado a `public/` en la instalación (`scripts/copy-maplibre-worker.mjs`). */
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/** Zoom máximo al encuadrar un incendio: más cerca, los píxeles de VIIRS dejan de tener sentido. */
const FIRE_MAX_ZOOM = 11.5;

/**
 * Lente 2D: las celdas con fuego del mes, con la misma rampa de color del calendario. Si hay un
 * incendio confirmado, encima van sus focos VIIRS y MODIS y la cámara que lo vio.
 */
export function MapLensView({ onHover }: { onHover: (info: HoverInfo | null) => void }) {
  const zoneId = useLensStore((state) => state.zoneId);
  const month = useLensStore((state) => state.month);
  const selectCell = useLensStore((state) => state.selectCell);
  const mapFocus = useLensStore((state) => state.mapFocus);
  const zone = useZone(zoneId);
  const { data: cellsMonth } = useCells(month);
  const fire = useConfirmedFireAlert();
  const { data: hotspots } = useAlertHotspots(fire?.id ?? null);
  const { data: cameras } = useCameras();
  const mapRef = useRef<MapRef>(null);

  const cells = useMemo(() => cellsToGeoJson(cellsMonth?.cells ?? []), [cellsMonth]);
  const firePoints = useMemo(() => hotspotsToGeoJson(hotspots ?? []), [hotspots]);
  const fireCamera = cameras?.find((camera) => camera.id === fire?.cameraId);

  // Cada pedido de "Ver focos en el mapa" trae un id nuevo: vuela aunque sea el mismo incendio.
  useEffect(() => {
    if (mapFocus) mapRef.current?.fitBounds(mapFocus.bounds, { padding: 60, maxZoom: FIRE_MAX_ZOOM, duration: 1200 });
  }, [mapFocus]);

  if (!zone) return <p className="grid size-full place-items-center text-muted">Cargando zona…</p>;

  const handleHover = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const props = feature?.properties;
    if (!props) return onHover(null);
    if (HOTSPOT_LAYERS.includes(feature.layer.id)) return onHover({ title: props.title, detail: props.detail });
    onHover({ title: `${num(props.cellDays)} celdas-día`, detail: `FRP máx. ${num(props.frpMax)} MW` });
  };

  const handleClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (feature && HOTSPOT_LAYERS.includes(feature.layer.id)) return;
    const index = feature?.properties?.index;
    selectCell(index === undefined ? null : (cellsMonth?.cells[index] ?? null));
  };

  // Al montar (o al cambiar de zona) el mapa arranca en la zona; si había un encuadre pedido, va ahí.
  const handleLoad = () => {
    if (mapFocus) mapRef.current?.fitBounds(mapFocus.bounds, { padding: 60, maxZoom: FIRE_MAX_ZOOM, duration: 0 });
  };

  return (
    <Map
      ref={mapRef}
      key={zone.id}
      initialViewState={{ bounds: zone.bbox, fitBoundsOptions: { padding: 40 } }}
      mapStyle={BASEMAP}
      workerUrl={WORKER_URL}
      interactiveLayerIds={[CELL_LAYER, ...HOTSPOT_LAYERS]}
      onMouseMove={handleHover}
      onMouseLeave={() => onHover(null)}
      onClick={handleClick}
      onLoad={handleLoad}
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
      {fire && <HotspotLayers points={firePoints} camera={fireCamera ?? null} />}
    </Map>
  );
}
