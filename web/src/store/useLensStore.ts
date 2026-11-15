import { create } from "zustand";
import type { CellTuple, YearMonth } from "@/lib/types";

export type LensMode = "mapa" | "terreno" | "camara";
export type SeriesMode = "harm" | "raw";
export type MapScope = "sector" | "pais";

/** Lo que mira la lupa. Es lo único que guarda el historial del botón Return. */
interface LensTarget {
  zoneId: string;
  month: YearMonth;
  series: SeriesMode;
  mode: LensMode;
}

interface LensState extends LensTarget {
  scope: MapScope;
  cameraId: string | null;
  /** Celda que tocó el usuario en el mapa; se borra al cambiar de zona o de mes. */
  selectedCell: CellTuple | null;
  /** Estados anteriores, del más viejo al más nuevo; máximo 20. */
  history: LensTarget[];
  setZone: (zoneId: string) => void;
  setMonth: (month: YearMonth) => void;
  setSeries: (series: SeriesMode) => void;
  setMode: (mode: LensMode) => void;
  setScope: (scope: MapScope) => void;
  setCamera: (cameraId: string) => void;
  selectCell: (cell: CellTuple | null) => void;
  goBack: () => void;
}

const MAX_HISTORY = 20;

/** Caso de demostración (AGENTS.md): condado de Los Ángeles, enero de 2025. */
const INITIAL_TARGET: LensTarget = {
  zoneId: "us-ca-los-angeles",
  month: "2025-01",
  series: "harm",
  mode: "mapa",
};

function currentTarget(state: LensState): LensTarget {
  return { zoneId: state.zoneId, month: state.month, series: state.series, mode: state.mode };
}

export const useLensStore = create<LensState>()((set) => {
  /** Cambia una parte del objetivo y guarda el estado anterior para Return. */
  const moveTo = (change: Partial<LensTarget>) =>
    set((state) => {
      const before = currentTarget(state);
      const after = { ...before, ...change };
      const unchanged = (Object.keys(change) as (keyof LensTarget)[]).every(
        (key) => before[key] === after[key],
      );
      if (unchanged) return state;
      return {
        ...after,
        selectedCell: null,
        history: [...state.history, before].slice(-MAX_HISTORY),
      };
    });

  return {
    ...INITIAL_TARGET,
    scope: "sector",
    cameraId: null,
    selectedCell: null,
    history: [],
    setZone: (zoneId) => moveTo({ zoneId }),
    setMonth: (month) => moveTo({ month }),
    setSeries: (series) => moveTo({ series }),
    setMode: (mode) => moveTo({ mode }),
    setScope: (scope) => set({ scope }),
    setCamera: (cameraId) => set({ cameraId }),
    selectCell: (selectedCell) => set({ selectedCell }),
    goBack: () =>
      set((state) => {
        const previous = state.history.at(-1);
        if (!previous) return state;
        return { ...previous, selectedCell: null, history: state.history.slice(0, -1) };
      }),
  };
});
