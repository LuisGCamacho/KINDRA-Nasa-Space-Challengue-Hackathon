---
name: comentar-codigo
description: Agrega o mejora comentarios y documentación en el código de KINDRA (TypeScript/TSX, Python, SQL) con un estándar profesional, sin cambiar el comportamiento. Úsala cuando pidan “comentar”, “documentar”, “agregar comentarios”, “explicar el código en el código” o antes de entregar un archivo para revisión.
---

# Comentar código en KINDRA

Objetivo: que otra persona del equipo, o un jurado del hackathon, entienda **por qué** el código hace lo que hace, sin leerlo línea por línea. Un comentario profesional es preciso, breve y verificable; nunca repite el código.

## Reglas de oro

1. **No cambies el comportamiento.** Solo se tocan comentarios y docstrings. Ni nombres, ni formato, ni lógica. Si ves un error, avísalo en tu respuesta en vez de corregirlo.
2. **Explica el porqué, no el qué.** El código ya dice qué hace; el comentario dice la razón, la restricción o la fuente.
3. **Menos es más.** Un archivo bien nombrado necesita pocos comentarios. Si un comentario no le ahorra tiempo al lector, no lo escribas.
4. **Todo lo que afirmes debe ser cierto.** No inventes cifras, fuentes ni comportamientos. Si no lo puedes verificar en el código o en `AGENTS.md`, no lo escribas.
5. **Español neutro y técnico**, con tildes y ortografía correctas, en el formato del proyecto: `5,5×`, `1.234 focos`, `2012–2021`. Los identificadores se citan tal cual, entre comillas invertidas.

## Qué sí comentar

| Caso | Qué escribir |
|---|---|
| Función, componente, hook o ruta exportados | Una línea de propósito; parámetros y retorno si no son obvios; errores que lanza |
| Decisión del método científico | La regla y su motivo: celdas-día, satélite de referencia, factor VIIRS → MODIS, calibración 2012–2021, umbrales de nivel |
| Números mágicos | Unidad y origen: `0.1 // grados; grilla de Argentina` |
| Fechas y límites de datos | Qué evento marcan: `"2012-01-20" // inicio de VIIRS S-NPP en FIRMS` |
| Comportamiento no evidente | Respaldo a JSON si falla la base, caché, límites de la API de FIRMS (5 días por pedido) |
| Contratos de datos | Forma y unidades de los campos, por ejemplo que `harm` está en escala MODIS |
| Accesibilidad | Por qué existe un `aria-label` o un rayado además del color |
| Soluciones temporales | `TODO(rol):` o `FIXME(rol):` con qué falta y cuándo se quita |

## Qué no comentar

- Lo que el código ya dice: `i += 1 // suma uno`.
- Historia de cambios (“antes hacía…”, “cambiado por…”): eso va en Git.
- Código comentado: se borra; Git lo guarda.
- Opiniones, chistes, emojis, mayúsculas sostenidas o signos de exclamación.
- Nombres de personas: usa el rol (`Datos`, `Backend 1`, `Frontend`).
- Comentarios que tendrías que actualizar cada vez que cambie una línea vecina.

## Formato por lenguaje

### TypeScript / TSX: TSDoc

```ts
/**
 * Compara el mes elegido contra la mediana del mismo mes en los años anteriores.
 *
 * @param rows - Serie mensual de la zona, ordenada por `t` ascendente.
 * @param from - Primer mes del período (`YYYY-MM`).
 * @param to - Último mes del período (`YYYY-MM`); la app envía `from === to`.
 * @param kind - Serie a usar; `harm` está en escala MODIS.
 * @returns Valor actual, mediana, cociente y nivel.
 * @throws Error si el período supera 12 meses.
 */
export function comparePeriod(rows: MonthRow[], from: string, to: string, kind: SeriesKind): Stats {
```

- Bloque `/** … */` solo en lo exportado. Dentro de funciones, `//` en línea propia, encima de lo que explica.
- Componentes: describe qué muestra y de qué estado depende, no el JSX.
- Rutas de la API: método, parámetros, respuesta y códigos de error.

```ts
/**
 * GET /api/stats — Nivel de fuego de una zona en un mes.
 *
 * Parámetros: `zone`, `from`, `to` (`YYYY-MM`) y `kind` (por defecto `harm`).
 * Responde 400 si los parámetros no son válidos y 404 si la zona no existe.
 */
```

### Python: docstrings estilo Google

```python
def monthly_factors(cd: pd.DataFrame, n_boot: int = 300) -> pd.DataFrame:
    """Calcula el factor que lleva VIIRS a la escala MODIS, por región y mes.

    k = celdas-día Aqua / celdas-día VIIRS, calibrado solo en 2012–2021 porque
    después Terra y Aqua derivaron de órbita y cambió su hora de paso.

    Args:
        cd: Celdas-día con columnas `region`, `acq_date`, `satellite` y `sensor`.
        n_boot: Remuestreos para el intervalo del 90 %.

    Returns:
        Una fila por región y mes con `k`, `k_low`, `k_high` y `n_years`.
    """
```

- Docstring en todo módulo, clase y función pública. La primera línea es una oración en modo imperativo o descriptivo, terminada en punto.
- Comentarios `#` con un espacio, alineados con el código.

### SQL

```sql
-- Celdas con al menos un foco por mes. `geom` se calcula sola desde lat/lon
-- para que el índice GiST sirva en las consultas por recuadro del mapa.
create table cells_monthly (
```

### CSS / Tailwind

Comenta solo los tokens y utilidades con una regla de diseño detrás:

```css
--color-fire: #D64C29;   /* solo para fuego: nunca decorativo */
```

## Estilo de redacción

- Oraciones completas, en presente y en tercera persona: “Devuelve…”, “Calcula…”. No uses “nosotros” ni “yo”.
- Empieza con mayúscula y termina en punto, salvo comentarios de una frase corta al final de una línea.
- Hasta ~100 caracteres por línea; si hace falta más, usa varias líneas.
- Unidades siempre explícitas: grados, km², celdas-día, UTC, `YYYY-MM`.
- Usa los términos del proyecto: zona, focos, celdas-día, mediana, nivel, escala MODIS, serie armonizada.
- Cita fuentes con nombre: “NASA FIRMS”, “NASA POWER”, “Natural Earth”.

## Proceso

1. Lee `AGENTS.md` y el archivo completo antes de escribir.
2. Identifica lo exportado, las decisiones del método, los números mágicos y lo no evidente.
3. Revisa los comentarios existentes: corrige los incorrectos o desactualizados, borra los redundantes y el código comentado.
4. Escribe los comentarios siguiendo esta guía.
5. Verifica que el diff solo tenga comentarios y docstrings.
6. Corre las comprobaciones de la parte que tocaste y di qué pasó:
   - web: `npm run lint` y `npx tsc --noEmit`
   - Python: `python -m py_compile <archivo>` y `pytest -q`
7. En tu respuesta, resume qué documentaste y lista lo que encontraste pero no corregiste (posibles errores, dudas sobre el método).

## Ejemplos

Mal:

```ts
// calcular el nivel
const level = levelOf(ratio); // nivel
// const old = ratio > 2.5 ? "Muy alto" : ...
```

Bien:

```ts
// Los umbrales “Alto” y “Muy alto” vienen de Ajustes; Normal empieza en 1 / umbral alto.
const level = levelOf(ratio, high, veryHigh);
```

Mal:

```python
RES_AR = 0.1  # resolución
```

Bien:

```python
RES_AR = 0.1  # grados (~11 km); grilla de Argentina para contar celdas-día
```
