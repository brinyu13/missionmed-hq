import js from "@eslint/js";
import globals from "globals";

const nodeFiles = [
  "./{adapters,audit,documents,domain,http,observability,repositories,security,services}/**/*.{js,mjs}",
  "../lib/auth/session-token.mjs",
  "../scripts/lor-studio/**/*.mjs",
  "../tests/lor-studio/**/*.test.mjs",
  "../tests/auth/session-token.test.mjs",
];

const browserFiles = [
  "../public/lor-studio/production-adapter.js",
];

export default [
  {
    ...js.configs.recommended,
    name: "lor-studio/node",
    files: nodeFiles,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.nodeBuiltin,
    },
  },
  {
    ...js.configs.recommended,
    name: "lor-studio/browser-adapter",
    files: browserFiles,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: globals.browser,
    },
  },
];
