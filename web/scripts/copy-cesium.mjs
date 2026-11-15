// Copia los archivos estáticos de CesiumJS a public/cesium (Workers, Assets, Widgets, ThirdParty).
// Cesium los pide en tiempo de ejecución desde window.CESIUM_BASE_URL. Corre solo con "postinstall".
import { cpSync, mkdirSync } from "node:fs";

const FROM = "node_modules/cesium/Build/Cesium";
const TO = "public/cesium";
const FOLDERS = ["Workers", "ThirdParty", "Assets", "Widgets"];

mkdirSync(TO, { recursive: true });
for (const folder of FOLDERS) {
  cpSync(`${FROM}/${folder}`, `${TO}/${folder}`, { recursive: true });
}
console.log(`Cesium copiado a ${TO}`);
