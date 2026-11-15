import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Datos vivos de la demo: alertas, respuestas, detecciones y la cola de falsos positivos.
 * Viven en `web/data/live/` (fuera de Git) y solo se pueden escribir corriendo la app en una
 * computadora: Vercel no deja escribir archivos. Se calcula en cada llamada para que las
 * pruebas puedan apuntar `process.cwd()` a una carpeta temporal.
 */
function liveDir(): string {
  return path.join(process.cwd(), "data", "live");
}

/** Nombre permitido: carpetas y archivo en minúsculas con guiones, terminado en `.json`. */
const LIVE_NAME = /^([a-z0-9]+(-[a-z0-9]+)*\/)*[a-z0-9]+(-[a-z0-9]+)*\.json$/;

/** Cola de escrituras por archivo: dos pedidos a la vez no se pisan. */
const queues = new Map<string, Promise<unknown>>();

function livePath(name: string): string {
  const dir = liveDir();
  const fullPath = path.join(dir, name);
  if (!LIVE_NAME.test(name) || !fullPath.startsWith(dir + path.sep)) {
    throw new Error(`Nombre de archivo vivo no permitido: ${name}`);
  }
  return fullPath;
}

/** Lee un JSON vivo; si todavía no existe, devuelve `fallback`. Siempre lee del disco: Python lo cambia. */
export async function readLive<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(livePath(name), "utf-8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

/** Escribe en un archivo temporal y lo renombra: nunca queda un JSON a medias. */
async function writeLive<T>(name: string, value: T): Promise<void> {
  const target = livePath(name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(`${target}.tmp`, JSON.stringify(value, null, 2), "utf-8");
  await rename(`${target}.tmp`, target);
}

/**
 * Lee, cambia y guarda un JSON vivo de a un pedido por vez.
 * `change` recibe el valor actual y devuelve el nuevo (`next`) y lo que la función responde (`result`).
 */
export function updateLive<T, R>(name: string, fallback: T, change: (current: T) => { next: T; result: R }): Promise<R> {
  const previous = queues.get(name) ?? Promise.resolve();
  const run = previous.then(async () => {
    const { next, result } = change(await readLive(name, fallback));
    await writeLive(name, next);
    return result;
  });
  queues.set(name, run.catch(() => undefined));
  return run;
}
