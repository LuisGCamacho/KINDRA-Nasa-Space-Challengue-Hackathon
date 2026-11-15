import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Datos vivos de la demo: alertas, respuestas y la cola de falsos positivos.
 * Viven en `web/data/live/` (fuera de Git) y solo funcionan corriendo la app en una
 * computadora: Vercel no deja escribir archivos. Con Postgres, esto lo reemplaza `src/db/`.
 */
const LIVE_DIR = path.join(process.cwd(), "data", "live");

/** Cola de escrituras por archivo: dos pedidos a la vez no se pisan. */
const queues = new Map<string, Promise<unknown>>();

function livePath(name: string): string {
  const fullPath = path.join(LIVE_DIR, name);
  if (!fullPath.startsWith(LIVE_DIR + path.sep)) throw new Error(`Ruta fuera de data/live: ${name}`);
  return fullPath;
}

/** Lee un JSON vivo; si todavía no existe, devuelve `fallback`. */
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
 * `change` recibe el valor actual y devuelve el nuevo y lo que la función debe responder.
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
