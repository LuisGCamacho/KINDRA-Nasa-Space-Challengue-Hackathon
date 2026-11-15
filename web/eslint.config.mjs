import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
  // Default ignores of eslint-config-next:
  ".next/**",
  "out/**",
  "build/**",
  "next-env.d.ts",
  // Archivos de Cesium que genera scripts/copy-cesium.mjs: no son código del equipo.
  "public/cesium/**",
  // Worker de MapLibre que copia scripts/copy-maplibre-worker.mjs: tampoco es código del equipo.
  "public/maplibre/**",
]),
]);

export default eslintConfig;
