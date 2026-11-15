/** Respuesta de `/api/weather`: el pronóstico de MET Norway para la hora actual. */
export interface WeatherNow {
  /** Hora del dato, ISO 8601 en UTC. */
  at: string;
  temperatureC: number;
  humidityPct: number;
  windKmh: number;
  /** De dónde viene el viento, en grados (0 = norte). */
  windFromDeg: number;
}

const COMPASS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];

/** 230° → "suroeste". */
export function compassPoint(degrees: number): string {
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}
