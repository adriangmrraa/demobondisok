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
    // Assets estáticos servidos tal cual: bundles vendor copiados por
    // scripts/copy-maplibre-worker.mjs desde node_modules (predev/prebuild).
    // No son código fuente del equipo.
    "public/**",
  ]),
]);

export default eslintConfig;
