import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import globals from "globals";
import reLint from "@re-cinq/eslint-plugin-re-lint";

const serverFiles = ["src/**/*.js", "tests/**/*.js", "*.js", "openwrt/**/*.js"];
const browserFiles = ["public/**/*.js"];
const testFiles = ["tests/**/*.js"];

export default tseslint.config(
  { ignores: ["node_modules/**", "coverage/**", "openwrt-agent/**", "public/assets/**"] },
  ...reLint.configs.recommended({ tseslint, stylistic }),
  {
    files: ["**/*.md"],
    plugins: { markdown, "re-lint": reLint },
    language: "markdown/gfm",
    rules: { "re-lint/no-dead-md-links": "error" },
  },
  {
    files: serverFiles,
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },
  {
    files: testFiles,
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    files: browserFiles,
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser },
    },
  },
  {
    files: ["src/**/*.js", "public/**/*.js", "*.js"],
    plugins: { "re-lint": reLint },
    rules: {
      "re-lint/no-prop-mutation": "error",
      "re-lint/no-duplicate-code": ["error", { roots: ["src", "public/js", "public/app.js"] }],
    },
  },
  {
    files: ["**/*.css"],
    plugins: { css, "re-lint": reLint },
    language: "css/css",
    languageOptions: { tolerant: true },
    rules: { "re-lint/prefer-design-tokens": "error" },
  },
);
