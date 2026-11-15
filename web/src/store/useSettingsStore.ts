import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_HIGH, DEFAULT_VERY_HIGH } from "@/lib/levels";

interface SettingsState {
  /** Umbral de "Alto" (por defecto 1,5×). El límite inferior de Normal es siempre `1 / high`. */
  high: number;
  /** Umbral de "Muy alto" (por defecto 3×). */
  veryHigh: number;
  setThresholds: (high: number, veryHigh: number) => void;
  reset: () => void;
}

/** Ajustes de la persona; se guardan en el navegador. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      high: DEFAULT_HIGH,
      veryHigh: DEFAULT_VERY_HIGH,
      setThresholds: (high, veryHigh) => set({ high, veryHigh }),
      reset: () => set({ high: DEFAULT_HIGH, veryHigh: DEFAULT_VERY_HIGH }),
    }),
    { name: "kindra-ajustes" },
  ),
);
