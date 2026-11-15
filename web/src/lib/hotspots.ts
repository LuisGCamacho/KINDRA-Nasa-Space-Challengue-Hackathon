import type { FeatureCollection, Point } from "geojson";
import type { FirmsHotspot, HotspotSensor } from "./alert-types";
import type { YearMonth, Zone } from "./types";
import { num } from "./format";
import { formatLocalTime } from "./time";

/**
 * Cada sensor con su color y su forma, para distinguirlos sin depender solo del color: VIIRS
 * (píxel de 375 m) es un punto lleno y MODIS (píxel de 1 km) un anillo más grande.
 */
export const SENSOR_STYLE: Record<HotspotSensor, { color: string; label: string }> = {
  VIIRS: { color: "#D7262B", label: "VIIRS · 375 m" },
  MODIS: { color: "#FFD166", label: "MODIS · 1 km" },
};

/** Nombre del satélite para la pantalla; acepta las fuentes del archivo y las NRT. */
const SATELLITE_NAME: Record<string, string> = {
  VIIRS_NOAA20: "VIIRS NOAA-20",
  VIIRS_NOAA21: "VIIRS NOAA-21",
  VIIRS_SNPP: "VIIRS Suomi NPP",
  MODIS: "MODIS",
};

/** Margen en grados alrededor de los focos al encuadrar el mapa (~3 km). */
const BOUNDS_MARGIN_DEG = 0.03;

export function satelliteName(source: string): string {
  return SATELLITE_NAME[source.replace(/_NRT$/, "")] ?? source;
}

export interface HotspotProps {
  sensor: HotspotSensor;
  color: string;
  title: string;
  detail: string;
}

/** Focos como puntos del mapa, con el texto que se muestra al pasar el cursor. */
export function hotspotsToGeoJson(points: FirmsHotspot[]): FeatureCollection<Point, HotspotProps> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: point.position },
      properties: {
        sensor: point.sensor,
        color: SENSOR_STYLE[point.sensor].color,
        title: `Foco ${satelliteName(point.source)}`,
        detail: [
          formatLocalTime(point.acquiredAt),
          point.frp === null ? null : `FRP ${num(point.frp, 1)} MW`,
          `a ${num(point.distanceKm, 1)} km de la cámara`,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    })),
  };
}

/** Recuadro `[oeste, sur, este, norte]` que contiene los focos y la cámara, con un margen. */
export function hotspotBounds(points: FirmsHotspot[], camera: [number, number]): [number, number, number, number] {
  const lons = [camera[0], ...points.map((point) => point.position[0])];
  const lats = [camera[1], ...points.map((point) => point.position[1])];
  return [
    Math.min(...lons) - BOUNDS_MARGIN_DEG,
    Math.min(...lats) - BOUNDS_MARGIN_DEG,
    Math.max(...lons) + BOUNDS_MARGIN_DEG,
    Math.max(...lats) + BOUNDS_MARGIN_DEG,
  ];
}

/**
 * La zona más chica cuyo recuadro contiene el punto (el condado antes que el estado). Es por
 * recuadro, no por límite exacto: cerca del borde entre dos condados puede elegir el vecino.
 */
export function zoneContaining(zones: Zone[], [lon, lat]: [number, number]): Zone | undefined {
  return zones
    .filter(({ bbox: [west, south, east, north] }) => lon >= west && lon <= east && lat >= south && lat <= north)
    .toSorted((a, b) => a.areaKm2 - b.areaKm2)[0];
}

/** Mes del primer foco, en hora UTC como el resto de la serie: el incendio puede ser de otro mes que la alerta. */
export function hotspotsMonth(points: FirmsHotspot[]): YearMonth | null {
  const first = points.map((point) => point.acquiredAt).toSorted()[0];
  return first ? first.slice(0, 7) : null;
}
