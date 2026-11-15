"use client";

import { useEffect, useState, type RefObject } from "react";
import type { FireRegion, TrackFrame } from "@/lib/alert-types";

/** El cuadro con `t` más cercano al segundo actual del video. */
function frameAt(frames: TrackFrame[], seconds: number): TrackFrame {
  let closest = frames[0];
  for (const frame of frames) {
    if (Math.abs(frame.t - seconds) < Math.abs(closest.t - seconds)) closest = frame;
  }
  return closest;
}

/**
 * Recuadros que tocan en este momento del video. Usa `requestVideoFrameCallback`,
 * que avisa en cada cuadro pintado: así el recuadro no se adelanta ni se atrasa al humo.
 */
export function useVideoRegions(videoRef: RefObject<HTMLVideoElement | null>, frames: TrackFrame[]): FireRegion[] {
  const [regions, setRegions] = useState<FireRegion[]>([]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || frames.length === 0) return;

    let handle = 0;
    const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
      setRegions(frameAt(frames, metadata.mediaTime).regions);
      handle = video.requestVideoFrameCallback(onFrame);
    };
    handle = video.requestVideoFrameCallback(onFrame);
    return () => video.cancelVideoFrameCallback(handle);
  }, [videoRef, frames]);

  return regions;
}
