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
