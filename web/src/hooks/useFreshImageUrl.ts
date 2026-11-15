"use client";

import { useEffect, useState } from "react";

/**
 * URL de la foto de una cámara que se renueva cada `refreshSeconds`.
 *
 * Caltrans publica la foto nueva siempre en la misma URL: sin cambiarla, el navegador muestra la
 * que ya tiene guardada. Se le agrega `?t=<hora>` para obligarlo a pedirla otra vez. Con la
 * pestaña oculta no se pide nada, y al volver se renueva enseguida.
 *
 * El primer render usa la URL tal cual, así el servidor y el navegador pintan lo mismo.
 */
export function useFreshImageUrl(url: string, refreshSeconds: number): string {
  const [stamp, setStamp] = useState<number | null>(null);

  useEffect(() => {
    const renew = () => {
      if (document.visibilityState === "visible") setStamp(Date.now());
    };
    const timer = window.setInterval(renew, refreshSeconds * 1000);
    document.addEventListener("visibilitychange", renew);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", renew);
    };
  }, [url, refreshSeconds]);

  if (stamp === null) return url;
  return `${url}${url.includes("?") ? "&" : "?"}t=${stamp}`;
}
