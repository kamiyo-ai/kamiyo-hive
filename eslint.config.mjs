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
  ]),
  {
    rules: {
      // Useful as a signal, but too noisy to block the build right now.
      "@typescript-eslint/no-explicit-any": "warn",

      // This repo contains Node-only scripts/tests and circuit tooling that use CJS.
      "@typescript-eslint/no-require-imports": "off",

      // These newer React rules are not compatible with the three.js / r3f code
      // in this repo (intentional mutation + per-frame randomness).
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
