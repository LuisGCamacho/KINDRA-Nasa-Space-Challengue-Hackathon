"use client";

import { useMemo } from "react";
import Map, { Layer, NavigationControl, Source } from "react-map-gl/maplibre";
import type { RasterDEMSourceSpecification, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCells, useZone } from "@/hooks/queries";
import { useLensStore } from "@/store/useLensStore";
import { cellsToGeoJson } from "@/lib/geo";

/** Worker de MapLibre copiado a `public/` en la instalación (`scripts/copy-maplibre-worker.mjs`). */
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

/** Relieve: Terrain Tiles abiertos en AWS (formato Terrarium), sin clave. */
const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
/**
 * Imagen: mosaico Sentinel-2 cloudless 2024 de EOX (10 m por píxel, sin nubes), sin clave. Licencia
 * CC BY-NC-SA 4.0: libre para uso no comercial con crédito. Se eligió sobre las ortofotos del USGS
 * porque cubre tierra y mar parejo: el USGS devuelve teselas blancas sólidas sobre el océano en
 * algunos niveles de zoom.
 */
const IMAGERY_TILES = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg";
/**
 * Créditos que piden las licencias, en el mismo lugar que el de la lente de cámara. La caja de
 * MapLibre era blanca y tapaba el borde de la lupa.
 */
const CREDITS =
  "Imagen: Sentinel-2 cloudless 2024 de EOX (s2maps.eu), datos Copernicus Sentinel modificados · Relieve: Terrain Tiles (Mapzen, AWS)";

/** Fondo de la app (`--color-base`): el cielo y lo que falte de imagen se funden con la página. */
const BASE_COLOR = "#04050c";
/** El relieve se exagera un poco: a la altura de un condado, 1× se ve casi plano. */
const TERRAIN_EXAGGERATION = 1.5;
const VIEW_PITCH_DEG = 60;

const dem: RasterDEMSourceSpecification = {
  type: "raster-dem",
  tiles: [TERRAIN_TILES],
  encoding: "terrarium",
  tileSize: 256,
  maxzoom: 15,
};

/**
 * Estilo del mapa 3D. El sombreado usa una copia aparte del relieve (`sombra`): MapLibre
 * recomienda no compartir la misma fuente entre el terreno y el sombreado.
 */
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    imagen: { type: "raster", tiles: [IMAGERY_TILES], tileSize: 256, maxzoom: 15 },
    relieve: dem,
    sombra: dem,
  },
  layers: [
    { id: "fondo", type: "background", paint: { "background-color": BASE_COLOR } },
    { id: "imagen", type: "raster", source: "imagen" },
    { id: "sombra", type: "hillshade", source: "sombra", paint: { "hillshade-exaggeration": 0.35 } },
  ],
  terrain: { source: "relieve", exaggeration: TERRAIN_EXAGGERATION },
  // Sin cielo propio MapLibre pinta el horizonte casi blanco, que encandila en la interfaz oscura.
  sky: { "sky-color": BASE_COLOR, "horizon-color": "#1b2233", "fog-color": BASE_COLOR, "horizon-fog-blend": 0.6 },
};

/**
 * Lente 3D: relieve con imagen satelital y las celdas con fuego del mes encima, todo con fuentes
 * abiertas y sin clave. Reemplaza a Google 3D Tiles con CesiumJS, que pedían facturación en
 * Google Cloud. Se gira con clic derecho o con dos dedos.
 */
export default function TerrainLensView() {
  const zone = useZone(useLensStore((state) => state.zoneId));
  const month = useLensStore((state) => state.month);
  const { data: cellsMonth } = useCells(month);
  const cells = useMemo(() => cellsToGeoJson(cellsMonth?.cells ?? []), [cellsMonth]);

  if (!zone) return <p className="grid size-full place-items-center text-muted">Cargando zona…</p>;

  return (
    <figure className="relative size-full">
      <Map
        key={zone.id}
        initialViewState={{ bounds: zone.bbox, fitBoundsOptions: { padding: 40 }, pitch: VIEW_PITCH_DEG }}
        maxPitch={85}
        mapStyle={STYLE}
        workerUrl={WORKER_URL}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" visualizePitch showZoom={false} />
        <Source id="celdas" type="geojson" data={cells}>
          <Layer
            id="celdas-3d"
            type="circle"
            paint={{
              "circle-color": ["get", "color"],
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 10, 12],
              "circle-opacity": 0.9,
              "circle-stroke-color": BASE_COLOR,
              "circle-stroke-width": 1,
              "circle-pitch-alignment": "map",
            }}
          />
        </Source>
      </Map>
      <figcaption className="pointer-events-none absolute inset-x-[18%] bottom-[7%] text-center text-[10.5px] leading-snug text-heading/80 [text-shadow:0_1px_3px_rgb(0_0_0/0.9)]">
        {CREDITS}
      </figcaption>
    </figure>
  );
}
