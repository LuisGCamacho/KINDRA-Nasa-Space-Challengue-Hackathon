import "server-only"
import {readFile} from "node:fs/promises"
import path from "node:path"
import type { CellsMonth, Forecast, HarmonizationFactors, Series, Validation, YearMonth, Zone } from "@/lib/types"
import type { Camera } from "@/lib/alert-types"
import * as db from "@/db/queries"

/*
  Lectura de datos de la API. Primero Postgres (si hay `DATABASE_URL`); si la base no está,
  falla, tarda o no tiene el dato, se usan los JSON de `web/data/` que exporta Python.
  La app tiene que funcionar sin base de datos (AGENTS.md).
*/

/**Carpeta de los json de respaldo que exporta python */
const DATA_DIR = path.join(process.cwd(), "data");

/** Alcance de las celdas: California (`ca`) en 0,1° o el resto del mundo en 0,5°, igual que `SCOPES` en `ml/kindra/config.py`. */
export type CellScope = "ca" | "world";

// ─── Postgres con respaldo ─────────────────────────────────────────────

/** Tiempo máximo de una consulta: después se usa el JSON. */
export const DB_TIMEOUT_MS = 3_000;

/** Después de una falla, la base se deja de intentar este tiempo: los pedidos van directo al JSON. */
export const DB_RETRY_AFTER_MS = 60_000;

/** Hasta cuándo no se intenta la base (milisegundos Unix); 0 = se puede intentar. */
let databasePausedUntil = 0;

/** Rechaza si la consulta tarda más que `DB_TIMEOUT_MS`. */
function withTimeout<T>(query: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`La base tardó más de ${DB_TIMEOUT_MS} ms`)), DB_TIMEOUT_MS);
    });
    return Promise.race([query, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Pide el dato a Postgres y, si no se puede, al JSON.
 * - Sin `DATABASE_URL` o con la base en pausa: JSON directo.
 * - Si la base falla o tarda: registra el error, pausa la base `DB_RETRY_AFTER_MS` y usa el JSON.
 * - Si la base responde sin el dato (`null`): JSON, por si Python exportó y todavía no cargó.
 */
async function fromDatabaseOr<T>(what: string, query: () => Promise<T | null>, fallback: () => Promise<T | null>): Promise<T | null> {
    if (!db.hasDatabase() || Date.now() < databasePausedUntil) return fallback();
    try {
        return (await withTimeout(query())) ?? (await fallback());
    } catch (error) {
        databasePausedUntil = Date.now() + DB_RETRY_AFTER_MS;
        console.error(`[data] Postgres no respondió (${what}); se usan los JSON por ${DB_RETRY_AFTER_MS / 1000} s`, error);
        return fallback();
    }
}

/** Solo para pruebas: vuelve a permitir la base enseguida. */
export function resetDatabasePause(): void {
    databasePausedUntil = 0;
}

// ─── JSON de web/data/ ──────────────────────────────────────────────────

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

// ─── Lecturas que usan las rutas ───────────────────────────────────────

/** Todas las zonas; lista vacía si no hay datos ni en la base ni en `zones.json`. */
export async function getZones(): Promise<Zone[]> {
    const zones = await fromDatabaseOr(
        "zonas",
        async () => {
            const rows = await db.listZones();
            return rows.length ? rows : null;
        },
        () => readJson<Zone[]>("zones.json"),
    );
    return zones ?? [];
}

/**Una zona por id, o null si no existe */
export async function getZone(zoneId:string): Promise<Zone | null> {
    const zones = await getZones();
    return zones.find(zone => zone.id === zoneId) ?? null;
}

/** Serie mensual de una zona, o `null` si no existe. */
export function getSeries(zoneId:string): Promise<Series | null> {
    return fromDatabaseOr(`serie ${zoneId}`, () => db.seriesOf(zoneId), () => readJson<Series>(`series/${zoneId}.json`));
}

/**Celdas con fuego de un mes o null si ese mes no tiene archivo */
export function getCells(scope:CellScope, month: YearMonth): Promise<CellsMonth | null> {
    return fromDatabaseOr(
        `celdas ${scope} ${month}`,
        () => db.cellsOf(scope, month),
        () => readJson<CellsMonth>(`cells/${scope}/${month}.json`),
    );
}

/** Último pronóstico de las próximas 24 h. */
export function getForecast(): Promise<Forecast | null> {
    return fromDatabaseOr("pronóstico", db.latestForecast, () => readJson<Forecast>("forecast/latest.json"));
}

/** Cámaras públicas que eligió el equipo, con su crédito y condiciones de uso; lista vacía si no hay `cameras.json`. */
export async function getCameras(): Promise<Camera[]> {
    return (await readJson<Camera[]>("cameras.json")) ?? [];
}

/** Una cámara por id, o `null` si no está en la lista. */
export async function getCamera(cameraId: string): Promise<Camera | null> {
    const cameras = await getCameras();
    return cameras.find((camera) => camera.id === cameraId) ?? null;
}

/** Factores de armonización VIIRS → MODIS por región, satélite y mes, o `null` si no hay. */
export function getFactors(): Promise<HarmonizationFactors | null> {
    return fromDatabaseOr("factores", db.factors, () => readJson<HarmonizationFactors>("factors.json"));
}

/** Series de todas las zonas que tengan serie. */
export async function getAllSeries(): Promise<Series[]> {
    const zones = await getZones();
    const series = await Promise.all(zones.map((zone) => getSeries(zone.id)));
    return series.filter((item): item is Series => item !== null);
}

/** Resultados de la validación de la armonización. */
export function getValidation(): Promise<Validation | null> {
    return fromDatabaseOr("validación", db.validationItems, () => readJson<Validation>("validation.json"));
}
