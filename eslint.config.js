import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default tseslint.config(
  { ignores: ["dist/**", "artifacts/**", "cache/**", "coverage/**", "server/vendor/**", ".backstop/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["scripts/**/*.mjs", "server/**/*.ts", "server/**/*.mjs", "api/**/*.ts", "scripts/**/*.ts"], languageOptions: { globals: globals.node } },
  {
    files: ["**/*.cjs"],
    languageOptions: { globals: { ...globals.node, ...globals.mocha } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
