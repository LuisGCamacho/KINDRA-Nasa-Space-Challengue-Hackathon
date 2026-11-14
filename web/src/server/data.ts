import "server-only"
import {readFile} from "node:fs/promises"
import path from "node:path"
import type { CellsMonth, Forecast, Series, Validation, YearMonth, Zone } from "@/lib/types"

/**Carpeta de los json de respaldo que exporta python */
const DATA_DIR = path.join(process.cwd(), "data");

/**Alcance de las celdas: Argentina en 0,1 o el resto del mundo en 0,5 */
export type CellScope = "ar" | "world";

/**Lecturas ya hechas guardadas como promises */
const cache = new Map<string, Promise<unknown>>();
const useCache = process.env.NODE_ENV === "production";

/**Indica si el error es "el archivo no existe" */
function isFileMissing(error:unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

/**Lee y parsea un JSON */
async function readJson<T>(relativePath:string): Promise<T | null> {
    const fullPath = path.join(DATA_DIR, relativePath);
    if (!fullPath.startsWith(DATA_DIR + path.sep)) {
        throw new Error(`Ruta fuera de web/data: ${relativePath}`);
    }

    const cached = cache.get(relativePath);
    if (cached) return cached as Promise<T | null>;

    const reading = readFile(fullPath, "utf-8")
        .then((text) => JSON.parse(text) as T)
        .catch((error: unknown) => {
            cache.delete(relativePath);
            if (isFileMissing(error)) return null;
            throw error;
        });

    if (useCache) cache.set(relativePath, reading);
    return reading;
}

/**Todas las zonas */
export async function getZones(): Promise<Zone[]> {
    return (await readJson<Zone[]>("zones.json")) ?? [];
}

/**Una zona por id, o null si no existe */
export async function getZone(zoneId:string): Promise<Zone | null> {
    const zones = await getZones();
    return zones.find(zone => zone.id === zoneId) ?? null;
}

/**Serie menusla de una zona o null si no existe */
export function getSeries(zoneId:string): Promise<Series | null> {
    return readJson<Series>(`series/${zoneId}.json`);
}

/**Celdas con fuego de un mes o null si ese mes no tiene archivo */
export function getCells(scope:CellScope, month: YearMonth): Promise<CellsMonth | null> {
    return readJson<CellsMonth>(`cells/${scope}/${month}.json`);
}

/**Ultimo pronostico de las proximas 24h */
export function getForecast(): Promise<Forecast | null> {
    return readJson<Forecast>("forecast/latest.json");
}

/**Resultados de la validacion de la armonizacion  */
export function getValidation(): Promise<Validation | null> {
    return readJson<Validation>("validation.json");
}