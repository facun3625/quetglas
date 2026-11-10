import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Reglas de estilo/optimización muy estrictas de React 19: el código existente
      // sincroniza estado en efectos a propósito. Se dejan como aviso, no como error.
      "react-hooks/set-state-in-effect": "warn",
      // Los textos están en español, con comillas y apóstrofes normales en el JSX.
      "react/no-unescaped-entities": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "arai/**",
    "corto app/**",
    "moda/**",
    "src/generated/**",
    // Scripts de prueba de punta a punta (corren con esbuild, no forman parte de la app)
    "tests/e2e/**",
  ]),
]);

export default eslintConfig;
