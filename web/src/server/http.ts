import { z } from "zod";
import { isYearMonth, monthSpan } from "@/lib/period";
import type { ApiError } from "@/lib/types";

/** Máximo de meses que acepta un período. */
export const MAX_PERIOD_MONTHS = 12;

//--- Respuestas de error
/** Respuesta de error con el formato único de la API. */
export function errorResponse(status:number, message:string): Response {
    return Response.json({error:message} satisfies ApiError, {status});
}

/** 400: parámetros inválidos o faltantes. */
export const badRequest = (message = "Parámetros inválidos") => errorResponse(400, message);

/** 404: la zona, el mes o el archivo pedido no existe. */
export const notFound = (message = "No encontrado") => errorResponse(404, message);

/** 500: error inesperado. Registra el detalle en el servidor y responde un mensaje genérico. */
export function serverError(error:unknown): Response {
    console.error("[api]", error);
    return errorResponse(500, "Error interno del servidor");
}

//--- Esquemas de parámetros
/** Id de zona: minúsculas, números y guiones, por ejemplo `ar-lr-chilecito`.
 */
export const zoneIdSchema = z
.string({error: "Falta el parámetro zone"})
.max(64, {error: "zone es demasiado largo"})
.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {error: "zone no es un id de zona válido"});

/** Mes en formato `YYYY-MM`. */
export const yearMonthSchema = z
.string({error: "Falta un mes (YYYY-MM)"}).
refine(isYearMonth, {error: "El mes debe tener el formato YYYY-MM"});

/** Columna de la serie; si no viene, se usa la armonizada. */
export const kindSchema = z
.enum(["harm", "raw", "modis", "viirs"], {error: "kind debe ser harm, raw, modis o viirs"})
.default("harm");

/** Recuadro `oeste,sur,este,norte` en grados; devuelve `[oeste, sur, este, norte]`, el mismo orden que `Zone.bbox`. */
export const bboxSchema = z
.string()
.transform((value) => value.split(",").map(Number))
.refine(
    (b): b is [number, number, number, number] =>
    b.length === 4 &&
    b.every(Number.isFinite) &&
    b[0] < b[2] &&
    b[1] < b[3] &&
    b[0] >= -180 && b[2] <= 180 &&
    b[1] >= -90 && b[3] <= 90,
    { error: "bbox debe ser oeste,sur,este,norte en grados" },
);

/** Período `from`–`to`, de 1 a 12 meses, con `from` antes o igual que `to`. */
export const periodSchema = z
.object({from: yearMonthSchema, to: yearMonthSchema})
.refine((p) => p.from <= p.to, {error: "from no puede ser posterior a to", path: ["from"]})
.refine((p) => monthSpan(p.from, p.to) <= MAX_PERIOD_MONTHS,{
    error: `El período no puede pasar de ${MAX_PERIOD_MONTHS} meses`,
    path: ["to"],
});

//--- Lectura de la query
/** Resultado de `parseQuery`: los datos validados o la respuesta 400 lista para devolver. */
export type ParsedQuery<T> = {ok: true; data: T} | {ok: false; response: Response};

/**
 * Valida los parámetros de la URL con un esquema de zod.
 * Si un parámetro se repite, se toma el último valor.
 */
export function parseQuery<T>(request:Request, schema:z.ZodType<T>): ParsedQuery<T> {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const result = schema.safeParse(params);
    if (result.success) return {ok: true, data: result.data};
    return {ok: false, response: badRequest(result.error.issues[0]?.message)};
}

