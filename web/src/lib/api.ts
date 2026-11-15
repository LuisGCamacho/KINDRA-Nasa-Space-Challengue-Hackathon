import type { ApiError } from "./types";

/** Pide JSON a la API propia. Si la respuesta es un error, lanza su mensaje en español. */
export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error ?? `Error ${response.status} al pedir ${path}`);
  }
  return response.json() as Promise<T>;
}

/** Arma una ruta con parámetros, omitiendo los vacíos. */
export function withQuery(path: string, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
