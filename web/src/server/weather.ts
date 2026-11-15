import "server-only";
import { cacheLife } from "next/cache";
import type { WeatherNow } from "@/lib/weather";

/** MET Norway pide un User-Agent que identifique la app y un contacto (va en `.env.local`). */
const USER_AGENT = process.env.MET_USER_AGENT ?? "KINDRA/5.0 NASA-Space-Apps-2026";

interface MetNorwayResponse {
  properties: {
    timeseries: {
      time: string;
      data: {
        instant: {
          details: {
            air_temperature: number;
            relative_humidity: number;
            wind_speed: number;
            wind_from_direction: number;
          };
        };
      };
    }[];
  };
}

/**
 * Tiempo actual en un punto, de MET Norway. Se guarda una hora (MET actualiza cada hora).
 * Las coordenadas llegan con 4 decimales, como pide MET: así la caché sirve para pedidos cercanos.
 * Si MET falla, lanza un error (la ruta responde 502) y no se guarda nada en caché.
 */
export async function getWeatherNow(lat: string, lon: string): Promise<WeatherNow> {
  "use cache";
  cacheLife("hours");

  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`MET Norway respondió ${response.status}`);

  const body = (await response.json()) as MetNorwayResponse;
  const now = body.properties?.timeseries?.[0];
  if (!now) throw new Error("MET Norway no devolvió datos para ese punto");

  const details = now.data.instant.details;
  return {
    at: now.time,
    temperatureC: details.air_temperature,
    humidityPct: details.relative_humidity,
    windKmh: Math.round(details.wind_speed * 3.6 * 10) / 10,
    windFromDeg: details.wind_from_direction,
  };
}
