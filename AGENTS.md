# AGENTS.md — KINDRA

Contexto para cualquier agente de código que trabaje en este repositorio. Léelo completo antes de cambiar algo.

## Qué es

KINDRA es la solución del equipo para el **NASA Space Apps Challenge 2026** (14 y 15 de noviembre), reto **“Harmonization of MODIS and VIIRS Hot Spots”** (CONAE, Argentina).

Une 25 años de focos de calor de **MODIS** (desde noviembre de 2000) y **VIIRS** (desde enero de 2012), tomados de **NASA FIRMS**, en una sola serie armonizada. Responde una pregunta en segundos: **“¿el fuego de este mes en esta zona es normal para esta época del año?”**

- Usuario principal: analista de emergencias o de manejo del fuego.
- Caso de demostración: **Chilecito, La Rioja, julio de 2026**, que da “5,5× lo normal · Muy alto”.
- Idioma de la interfaz, los textos y los commits: **español** (formato argentino: `1.234 focos`, `5,5×`).

## Estado actual

El proyecto está recién creado: hay estructura de carpetas y dependencias, **todavía no hay código propio**.

- `web/` es un proyecto Next.js generado con `create-next-app`. La página de inicio sigue siendo la de ejemplo.
- Las carpetas vacías tienen un `.gitkeep` para que Git las guarde. Bórralo cuando la carpeta tenga archivos reales.
- Todavía no hay repositorio Git. Va en esta raíz (`git init` aquí, no dentro de `web/`).

## Documentos de referencia

El equipo tiene dos documentos de Word fuera del repositorio. Si te los pasan, son la fuente de verdad:

- **Tutorial completo KINDRA 3**: reparto de tareas, árbol de archivos, contratos de datos, código base de cada parte y cronograma.
- **Manual de interfaz KINDRA (nueva interfaz)**: colores, tipografía, componentes y capturas de cada pantalla.

Si este archivo y esos documentos no coinciden, pregunta antes de elegir.

## Stack

| Parte | Tecnología |
|---|---|
| App web y API | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Mapa | maplibre-gl + react-map-gl + deck.gl (solo 2D) |
| Estado y datos | zustand, @tanstack/react-query, zod |
| Base de datos | Postgres + PostGIS en Supabase; drizzle-orm + postgres |
| Datos y ML | Python 3.11: pandas, geopandas, duckdb, lightgbm, typer |
| Pruebas | vitest, @playwright/test, pytest |
| Despliegue | Vercel (la app); Python corre en las computadoras del equipo |

**Next.js 16 tiene cambios grandes.** Antes de escribir código en `web/`, lee [web/AGENTS.md](web/AGENTS.md) y la guía que corresponda en `web/node_modules/next/dist/docs/`.

## Estructura

```
KINDRA/
├── .github/workflows/      CI: lint, pruebas, build y pytest
├── db/                     esquema SQL (schema.sql) y migraciones
├── docs/                   textos del pitch, caso Chilecito, declaración de IA, capturas
├── ml/                     Python
│   ├── kindra/pipeline/    descarga FIRMS → limpieza → celdas-día → referencia → factor → zonas → series → export
│   ├── kindra/ml/          validación de la armonización y modelo de próximas 24 h
│   ├── data/raw|interim/   NO se suben a Git
│   ├── data/boundaries/    GeoJSON de entrada
│   ├── notebooks/  tests/
└── web/                    Next.js
    ├── data/               JSON de respaldo que exporta Python (series/, cells/ar|world/, forecast/)
    ├── public/geo/         GeoJSON del mapa
    ├── src/app/(app)/      páginas: explorar, proximas-24h, alertas, reportes, armonizacion, ajustes
    ├── src/app/api/        rutas: zones, series, stats, cells, forecast, validation, reports, alerts, health
    ├── src/server/         lógica del servidor: data.ts, stats.ts, csv.ts, bulletin.ts
    ├── src/db/             cliente Drizzle y consultas espaciales
    ├── src/components/     layout, controls, map, calendar, inspector, charts, ui
    ├── src/hooks/  src/store/  src/lib/
    └── tests/              vitest y e2e con Playwright
```

## Equipo y dueños

| # | Rol | Carpetas |
|---|---|---|
| 1 | Backend 1 · API (Next.js) | `web/src/app/api/`, `web/src/server/` |
| 2 | Backend 2 · ML (Python + API) | `ml/kindra/ml/`, `web/src/app/api/forecast/` |
| 3 | Frontend (Next.js + Tailwind) | `web/src/app/(app)/`, `web/src/components/` |
| 4 | Datos (Python) | `ml/kindra/pipeline/` |
| 5 | Base de datos e integración | `db/`, `web/src/db/`, `.github/`, `web/tests/` |

Trabaja dentro de las carpetas de la tarea que te pidieron. Si necesitas cambiar un contrato compartido, avisa en vez de cambiarlo por tu cuenta.

## Método (no cambiar sin acuerdo del equipo)

1. **Celdas-día:** una celda de la grilla con fuego en un día cuenta una vez, sin importar cuántos píxeles caigan. Grilla de 0,1° en Argentina y 0,5° en el resto del mundo.
2. **Un satélite de la tarde por fecha:** Terra hasta el 2002-07-04, Aqua hasta el 2012-01-20, Suomi NPP hasta el 2026-11-02 y después NOAA-20.
3. **Factor mensual:** `k = celdas-día Aqua / celdas-día VIIRS`, por región y mes, **calibrado en 2012–2021** (después, Terra y Aqua derivaron de órbita). **Lleva VIIRS a la escala MODIS**; en Argentina, k ≈ 0,2. Cada valor lleva intervalo (bootstrap).
4. **Comparación:** el mes elegido contra la **mediana del mismo mes** en los años anteriores.
5. **Niveles**, iguales en Python, API y pantalla:

   | Nivel | Cociente contra la mediana |
   |---|---|
   | Muy alto | ≥ 3× |
   | Alto | 1,5× a 3× |
   | Normal | 0,67× a 1,5× |
   | Bajo | < 0,67× |

   Los umbrales “Alto” y “Muy alto” se pueden cambiar en Ajustes; el límite inferior de Normal es siempre `1 / umbral alto`.

## Contratos de datos

Python escribe; la API lee de Postgres y, si la base no responde o falta `DATABASE_URL`, vuelve sola a los JSON de `web/data/`. **La app tiene que funcionar sin base de datos.**

- `web/data/zones.json`: `[{ id, name, type, parent, country, center, bbox, areaKm2 }]`
- `web/data/series/{zoneId}.json`: `{ zoneId, months: [{ t: "YYYY-MM", raw, harm, lo, hi, modis, viirs, src, partial }] }`. `harm` está en escala MODIS.
- `web/data/cells/{ar|world}/{YYYY-MM}.json`: `{ res, cells: [[lat, lon, celdasDia, frpMax]] }`
- `web/data/forecast/latest.json`: `{ issued, zones: [{ zoneId, p, expected: [min, max], trend }], metrics }`

La app pide **un solo mes**: `/api/stats?zone=&from=YYYY-MM&to=YYYY-MM` con `from = to`.

## Interfaz

La referencia visual es el prototipo de Lovable y el Manual de interfaz.

- **Pantallas:**
  - **Explorar**: mapa 2D de la zona arriba, calendario mes × año abajo, inspector de 320 px a la derecha.
  - **Próximas 24 h**: tabla de probabilidad por zona.
  - **Alertas**: tabla con filtro Todas / Muy alto / Alto.
  - **Reportes**: boletín y CSV.
  - **Armonización**: tres pasos, gráfico antes y después, tabla de factores.
  - **Ajustes**: sensor, confianza, unidades, umbrales y notificaciones.
- **Layout:** barra lateral de 216 px y encabezado de 56 px. En celular, la barra lateral pasa a pestañas horizontales. Puntos de quiebre: 1024, 768 y 640 px.
- **Colores:**
  - Base: pizarra `#1B2835` (texto y botón principal), fondo blanco, escenario del mapa `#EFEEEA`, bordes `#E5E4E2`.
  - Fuego: `#D64C29`. **El rojo es solo para el fuego.**
- **Calendario:** rampa de 6 tonos `#F4F3F1 #F6EEE8 #F9CDB5 #EF8D67 #D64C29 #892122`, lineal sobre valor / máximo con cortes en 12, 28, 50 y 80 %.
  - Años solo MODIS (2001–2011): rayado.
  - Sin datos: borde punteado.
  - Mes elegido: contorno pizarra de 2 px.
- **Niveles:** Muy alto con fondo `#78182B` y texto blanco; Alto `#FFE9E3`/`#7B2813`; Normal `#E5F3E9`/`#33724C`; Bajo `#EEEDEA`/`#3C4958`. Siempre con palabra, nunca solo color.
- **Tipografía:** Geist, con números tabulares en las cifras. Geist Mono solo para años y código. Base de 13 px; etiquetas de 10,5 px en mayúsculas.
- **Estilo:**
  - Radio de 6 px, botones de 32 px y sin sombras ni tarjetas: las secciones se separan con bordes de 1 px.
  - Tablas sin líneas oscuras: solo una línea fina `#E5E4E2` bajo el encabezado y entre filas.
  - Íconos lucide de 16 px.
- **Textos:** hablar como el usuario (“Zona”, “Focos”, no “AOI” ni “Detecciones”). Cada número va con su contexto (“5,5× lo normal para julio”). Lo que no está calculado se escribe “pendiente”: **nunca inventar cifras.**

## Fuera de alcance (se quitaron a propósito)

No agregues lo siguiente salvo que te lo pidan explícitamente: vista 3D, línea de tiempo, menú de filtros en el encabezado, selector de rango de períodos, mapa de viento, envío de alertas por LoRaWAN o Telegram, hardware ESP32, dibujo de áreas en el mapa, paleta cividis.

## Comandos

```bash
# web (desde web/)
npm run dev          # http://localhost:3000
npm run build
npm run lint
npx vitest run
npx playwright test

# Python (desde ml/)
python -m venv .venv && .venv\Scripts\activate
pip install -e ".[dev]"
python -m kindra download | build | load | validate | train | export
pytest -q
```

## Variables de entorno

Plantilla en `.env.example`; se copia a `ml/.env` y `web/.env.local`, y **nunca se suben a Git**.

- `FIRMS_MAP_KEY`: API de NASA FIRMS (ml).
- `DATABASE_URL`: cadena de conexión de Supabase (ml y web). Si falta, la app usa los JSON.

## Skills

Instrucciones para tareas concretas en `.agents/skills/` (con una copia idéntica en `.claude/skills/` para Claude Code; si cambias una, copia la otra). Antes de hacer una de estas tareas, lee el `SKILL.md` correspondiente y síguelo:

| Skill | Cuándo usarla |
|---|---|
| [comentar-codigo](.agents/skills/comentar-codigo/SKILL.md) | Agregar o mejorar comentarios y documentación (TSDoc, docstrings, SQL) sin cambiar el comportamiento |
| [vercel-react-best-practices](.agents/skills/vercel-react-best-practices/SKILL.md) | Escribir, revisar o refactorizar componentes React y páginas de Next.js: cargas en paralelo, tamaño del bundle, server components, re-renders |
| [api-design-principles](.agents/skills/api-design-principles/SKILL.md) | Diseñar o revisar rutas de `web/src/app/api/`: nombres, parámetros, códigos de error y formato de respuesta |
| [frontend-design](.agents/skills/frontend-design/SKILL.md) | Solo para interfaz nueva que el Manual no cubre (por ejemplo, la landing) |
| [clean-code](.agents/skills/clean-code/SKILL.md) | Escribir código nuevo, revisar pull requests o refactorizar dentro del alcance de la tarea: nombres claros, funciones chicas, manejo de errores |

**Prioridad:** si una skill contradice este archivo o el Manual de interfaz, mandan este archivo y el Manual. En particular, `frontend-design` no cambia la paleta, la tipografía ni los componentes ya definidos en la sección Interfaz. Tampoco quita las etiquetas en mayúsculas, que KINDRA usa a propósito. Las rutas de la API tampoco cambian los contratos de datos sin acuerdo del equipo.

Sobre `clean-code`:
- Cuando la tarea es comentar, manda `comentar-codigo`: no se reescribe código para evitar comentarios.
- Su regla “no devolver null” no aplica a los contratos de datos. `null` significa “sin dato” a propósito, como `modis` antes de 2012 o `median` sin historial.
- No hace falta seguir TDD a rajatabla en el hackathon, pero sí las pruebas de la sección Comandos.

## Reglas de trabajo

- `main` siempre funciona y se despliega solo. Usa una rama por tarea (`web/calendar`, `api/stats`, `datos/harmonize`…) y pull requests pequeños.
- Commits en español y claros: `feat(web): calendario con mes elegido`.
- Nunca subas `ml/data/raw/`, `ml/data/interim/`, `.env` ni claves.
- Mantén cada JSON de `web/data/` por debajo de ~5 MB.
- Todo lo pesado se precalcula en Python: la app nunca procesa millones de focos.
- Antes de dar algo por terminado, corre `npm run lint`, `npx vitest run` y `npm run build` (o `pytest`), y di qué pasó.
- Las cifras para el pitch se verifican en su fuente antes de usarlas.
