"use client";

import { useMemo } from "react";
import type { FeatureCollection, Point } from "geojson";
import { Layer, Source } from "react-map-gl/maplibre";
import type { ExpressionSpecification } from "maplibre-gl";
import type { Camera } from "@/lib/alert-types";
import { SENSOR_STYLE, type HotspotProps } from "@/lib/hotspots";

const VIIRS_LAYER = "focos-viirs";
const MODIS_LAYER = "focos-modis";
const CAMERA_LAYER = "camara-incendio";

/** Capas que responden al cursor con su propio texto (`title` y `detail`). */
export const HOTSPOT_LAYERS = [VIIRS_LAYER, MODIS_LAYER, CAMERA_LAYER];

/** Radio en px por zoom: a zoom 11 un píxel VIIRS (375 m) mide ~9 px y uno MODIS (1 km) ~24. */
const VIIRS_RADIUS: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 6, 2.5, 11, 8, 14, 16];
const MODIS_RADIUS: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 6, 4, 11, 16, 14, 32];

interface HotspotLayersProps {
  points: FeatureCollection<Point, HotspotProps>;
  camera: Camera | null;
}

/**
 * Focos FIRMS de un incendio confirmado, por sensor: VIIRS es un punto rojo lleno y MODIS un anillo
 * amarillo más grande, porque su píxel es casi tres veces más ancho. La cámara que vio el humo va en
 * blanco. Con una leyenda que dice qué es cada uno con palabras, no solo con color.
 */
export function HotspotLayers({ points, camera }: HotspotLayersProps) {
  const cameraPoint = useMemo<FeatureCollection<Point, { title: string; detail: string }>>(
    () => ({
      type: "FeatureCollection",
      features: camera
        ? [{ type: "Feature", geometry: { type: "Point", coordinates: camera.position }, properties: { title: camera.name, detail: "Cámara que vio el humo" } }]
        : [],
    }),
    [camera],
  );

  return (
    <>
      <Source id="focos-incendio" type="geojson" data={points}>
        <Layer
          id={MODIS_LAYER}
          type="circle"
          filter={["==", ["get", "sensor"], "MODIS"]}
          paint={{
            "circle-radius": MODIS_RADIUS,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": SENSOR_STYLE.MODIS.color,
            "circle-stroke-width": 2,
          }}
        />
        <Layer
          id={VIIRS_LAYER}
          type="circle"
          filter={["==", ["get", "sensor"], "VIIRS"]}
          paint={{
            "circle-radius": VIIRS_RADIUS,
            "circle-color": SENSOR_STYLE.VIIRS.color,
            "circle-opacity": 0.9,
            "circle-stroke-color": "#04050c",
            "circle-stroke-width": 1,
          }}
        />
      </Source>
      <Source id="camara-incendio" type="geojson" data={cameraPoint}>
        <Layer
          id={CAMERA_LAYER}
          type="circle"
          paint={{ "circle-radius": 6, "circle-color": "#ffffff", "circle-stroke-color": "#04050c", "circle-stroke-width": 2 }}
        />
      </Source>
      <ul
        aria-label="Focos del incendio"
        className="glass absolute bottom-[14%] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full px-3 py-1.5 text-[11.5px] text-heading"
      >
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: SENSOR_STYLE.VIIRS.color }} />
          {SENSOR_STYLE.VIIRS.label}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-full border-2" style={{ borderColor: SENSOR_STYLE.MODIS.color }} />
          {SENSOR_STYLE.MODIS.label}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full border border-base bg-white" />
          Cámara
        </li>
      </ul>
    </>
  );
}
