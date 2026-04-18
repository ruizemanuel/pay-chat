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
    // Hardhat-generated and contract-side code — linted via hardhat's own tools
    "typechain-types/**",
    "artifacts/**",
    "cache/**",
    "scripts/**",
    "test/contracts/**",
    "hardhat.config.ts",
  ]),
]);

export default eslintConfig;
