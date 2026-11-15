// Copia el worker de MapLibre a public/maplibre. MapLibre 6 lo busca junto a su propio código
// (`new URL("./maplibre-gl-worker.mjs", import.meta.url)`), pero Turbopack no publica ese archivo:
// sin esta copia el mapa de la Lupa queda negro ("Worker failed to load"). Corre con "postinstall".
import { copyFileSync, mkdirSync } from "node:fs";

const FROM = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
const TO = "public/maplibre";

mkdirSync(TO, { recursive: true });
copyFileSync(FROM, `${TO}/maplibre-gl-worker.mjs`);
console.log(`Worker de MapLibre copiado a ${TO}`);
