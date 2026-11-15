"use client";

import { useEffect, useRef, useState } from "react";

/** Tipo de contenido de las listas HLS (`.m3u8`) que publica Caltrans. */
const HLS_TYPE = "application/vnd.apple.mpegurl";

type Status = "cargando" | "en-vivo" | "sin-video";

/**
 * Video en vivo de una cámara pública (HLS de Caltrans).
 *
 * Safari y Edge reproducen HLS solos; Chrome y Firefox no, así que ahí se carga `hls.js`. Se
 * importa recién cuando hace falta para no sumarlo al bundle de todas las páginas.
 *
 * Si el video no arranca (Caltrans apaga cámaras sin avisar en su lista), se queda la última foto
 * de la cámara, con un aviso: mejor una foto vieja con su hora que un recuadro negro.
 */
export function LiveVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("cargando");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setStatus("cargando");

    let destroy = () => {};
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        // Sin MediaSource (Safari de iPhone viejo): ahí el navegador reproduce HLS solo.
        if (!video.canPlayType(HLS_TYPE)) return setStatus("sin-video");
        video.src = src;
        destroy = () => video.removeAttribute("src");
        return;
      }
      const hls = new Hls({ lowLatencyMode: true });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setStatus("sin-video");
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      destroy = () => hls.destroy();
    });
    return () => {
      cancelled = true;
      destroy();
    };
  }, [src]);

  if (status === "sin-video") {
    return (
      <div className="relative size-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- foto externa de Caltrans */}
        <img src={poster} alt={`Última foto de ${label}`} className="size-full object-cover" />
        <p className="absolute bottom-[15%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-base/80 px-3 py-1 text-[11px] text-muted">
          Video no disponible: última foto
        </p>
      </div>
    );
  }

  return (
    <div className="relative size-full">
      <video
        ref={videoRef}
        poster={poster}
        aria-label={`Video en vivo de ${label}`}
        autoPlay
        muted
        playsInline
        onPlaying={() => setStatus("en-vivo")}
        onError={() => setStatus("sin-video")}
        className="size-full object-cover"
      />
      <p className="absolute bottom-[15%] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-base/80 px-3 py-1 text-[11px]">
        {/* Blanco y no rojo: en KINDRA el rojo es solo para el fuego. */}
        <span className={`size-1.5 rounded-full ${status === "en-vivo" ? "bg-inverse" : "bg-muted"}`} aria-hidden />
        {status === "en-vivo" ? "En vivo" : "Conectando…"}
      </p>
    </div>
  );
}
