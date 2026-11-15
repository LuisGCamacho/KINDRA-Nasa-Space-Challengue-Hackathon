import type { FeatureCollection, Point } from "geojson";
import type { CellTuple } from "./types";
import type { WaterSource } from "./alert-types";
import { HEAT_RAMP, WATER_COLOR, heatIndex } from "./colors";

/** Propiedades de cada celda en el mapa. */
export interface CellProps {
  cellDays: number;
  frpMax: number;
  color: string;
  /** Posición de la celda en la lista original, para recuperarla al tocarla. */
  index: number;
}

/** Pasa las celdas del contrato (`[lat, lon, …]`) a GeoJSON (`[lon, lat]`) con su color ya resuelto. */
export function cellsToGeoJson(cells: CellTuple[]): FeatureCollection<Point, CellProps> {
  const max = Math.max(0, ...cells.map(([, , cellDays]) => cellDays));
  return {
    type: "FeatureCollection",
    features: cells.map(([lat, lon, cellDays, frpMax], index) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: { cellDays, frpMax, color: HEAT_RAMP[heatIndex(cellDays, max)], index },
    })),
  };
}

/** Fuentes de agua como puntos azules del mapa. */
export function waterToGeoJson(sources: WaterSource[]): FeatureCollection<Point, { name: string; color: string }> {
  return {
    type: "FeatureCollection",
    features: sources.map((source) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: source.position },
      properties: { name: source.name ?? "Sin nombre", color: WATER_COLOR },
    })),
  };
}

/** Distancia legible: "850 m" o "2,4 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Enlace de Google Maps a un punto `[lon, lat]`. */
export function googleMapsUrl([lon, lat]: [number, number]): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lon.toFixed(5)}`;
}

export interface ZoneCoord {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}