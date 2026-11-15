"use client";

import { useCallback, useSyncExternalStore } from "react";

const storageKey = (id: string) => `kindra.panel.${id}`;

/** Aviso a los paneles abiertos cuando otro cambia lo guardado (misma pestaña). */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStored(id: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(id));
  } catch {
    return null; // Sin almacenamiento (modo privado) el panel funciona igual, solo no recuerda.
  }
}

function writeStored(id: string, open: boolean): void {
  try {
    window.localStorage.setItem(storageKey(id), open ? "1" : "0");
  } catch {
    // Ver `readStored`.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Estado abierto o cerrado de un panel, recordado en `localStorage`.
 * En el servidor vale `defaultOpen`, así el HTML del servidor y el del navegador coinciden.
 */
export function usePanelOpen(id: string, defaultOpen: boolean): [boolean, () => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(id),
    () => null,
  );
  const open = stored === null ? defaultOpen : stored === "1";

  const toggle = useCallback(() => writeStored(id, !open), [id, open]);
  return [open, toggle];
}
