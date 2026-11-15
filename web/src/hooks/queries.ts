"use client";

import { useQuery } from "@tanstack/react-query";
import { getJson, withQuery } from "@/lib/api";
import type {
  Alert, Bulletin, CellsMonth, Forecast, HarmonizationFactors, Series, Stats, Validation, YearMonth, Zone,
} from "@/lib/types";
import type { Camera, Detection, FireAlert, TrackFrame, WaterSource } from "@/lib/alert-types";
import type { SeriesMode } from "@/store/useLensStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { WeatherNow } from "@/lib/weather";

/*
  Un hook por recurso de la API. Las pantallas nunca llaman a `fetch` directo:
  así la caché, los reintentos y las claves de react-query quedan en un solo lugar.
*/

export function useZones() {
  return useQuery({ queryKey: ["zones"], queryFn: () => getJson<Zone[]>("/api/zones") });
}

/** Una zona de la lista; reutiliza la caché de `useZones`. */
export function useZone(zoneId: string): Zone | undefined {
  const { data: zones } = useZones();
  return zones?.find((zone) => zone.id === zoneId);
}

/** Comparación de un solo mes contra la mediana del mismo mes (`from = to`). */
export function useStats(zoneId: string, month: YearMonth, series: SeriesMode) {
  return useQuery({
    queryKey: ["stats", zoneId, month, series],
    queryFn: () =>
      getJson<Stats>(withQuery("/api/stats", { zone: zoneId, from: month, to: month, kind: series })),
  });
}

/** Serie mensual completa de una zona, para el calendario. */
export function useSeries(zoneId: string) {
  return useQuery({
    queryKey: ["series", zoneId],
    queryFn: () => getJson<Series>(withQuery("/api/series", { zone: zoneId })),
  });
}

export function useCells(month: YearMonth) {
  return useQuery({
    queryKey: ["cells", "ca", month],
    queryFn: () => getJson<CellsMonth>(withQuery("/api/cells", { scope: "ca", month })),
  });
}

export function useCameras() {
  return useQuery({ queryKey: ["cameras"], queryFn: () => getJson<Camera[]>("/api/cameras") });
}

/** Última detección de la cámara; se refresca sola cada 30 s. */
export function useLatestDetection(cameraId: string | null) {
  return useQuery({
    queryKey: ["detection", cameraId],
    queryFn: () => getJson<Detection | null>(`/api/cameras/${cameraId}/detection`),
    enabled: cameraId !== null,
    refetchInterval: 30_000,
  });
}

/** Recuadros por segundo del video de la demo, ya calculados por Python. */
export function useTrack(cameraId: string | null) {
  return useQuery({
    queryKey: ["track", cameraId],
    queryFn: () => getJson<TrackFrame[]>(`/api/cameras/${cameraId}/track`),
    enabled: cameraId !== null,
    staleTime: Infinity,
  });
}

/** Detalle de una alerta, para la página de respuesta. */
export function useFireAlert(alertId: string | null) {
  return useQuery({
    queryKey: ["fire-alert", alertId],
    queryFn: () => getJson<FireAlert>(`/api/fire-alerts/${alertId}`),
    enabled: alertId !== null,
  });
}

export function useFireAlerts() {
  return useQuery({
    queryKey: ["fire-alerts"],
    queryFn: () => getJson<FireAlert[]>("/api/fire-alerts"),
    refetchInterval: 15_000,
  });
}

/** La alerta activa más reciente de una cámara, si la hay. Sale de la lista ya cargada. */
export function useCameraAlert(cameraId: string | null): FireAlert | undefined {
  const { data: alerts } = useFireAlerts();
  return alerts?.find((alert) => alert.cameraId === cameraId && alert.status !== "descartada");
}

/** Tiempo actual en un punto `[lon, lat]`; MET Norway actualiza cada hora. */
export function useWeather(position: [number, number] | null) {
  return useQuery({
    queryKey: ["weather", position],
    queryFn: () => getJson<WeatherNow>(withQuery("/api/weather", { lon: String(position![0]), lat: String(position![1]) })),
    enabled: position !== null,
    staleTime: 30 * 60_000,
  });
}

export function useWaterSources(alertId: string | null) {
  return useQuery({
    queryKey: ["water", alertId],
    queryFn: () => getJson<WaterSource[]>(`/api/fire-alerts/${alertId}/water`),
    enabled: alertId !== null,
  });
}

/** Pronóstico de próximas 24 h; Python lo vuelve a escribir varias veces por día. */
export function useForecast() {
  return useQuery({ queryKey: ["forecast"], queryFn: () => getJson<Forecast>("/api/forecast"), refetchInterval: 10 * 60_000 });
}

export function useValidation() {
  return useQuery({ queryKey: ["validation"], queryFn: () => getJson<Validation>("/api/validation") });
}

export function useFactors() {
  return useQuery({ queryKey: ["factors"], queryFn: () => getJson<HarmonizationFactors>("/api/factors") });
}

/**
 * Zonas en Alto o Muy alto en el mes elegido, con los umbrales de Ajustes. La API filtra y pone
 * el nivel con las dos reglas (cociente y mínimo de 10 celdas-día): la pantalla no lo recalcula.
 */
export function useZoneAlerts(month: YearMonth) {
  const high = useSettingsStore((state) => state.high);
  const veryHigh = useSettingsStore((state) => state.veryHigh);
  return useQuery({
    queryKey: ["zone-alerts", month, high, veryHigh],
    queryFn: () =>
      getJson<Alert[]>(withQuery("/api/alerts", { month, high: String(high), veryHigh: String(veryHigh) })),
  });
}

export function useBulletin(zoneId: string, month: YearMonth) {
  return useQuery({
    queryKey: ["bulletin", zoneId, month],
    queryFn: () => getJson<Bulletin>(withQuery("/api/reports/bulletin", { zone: zoneId, month })),
  });
}
