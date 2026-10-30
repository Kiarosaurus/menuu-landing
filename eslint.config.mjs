import { defineConfig, globalIgnores } from "eslint/config";
import prettierConfig from "eslint-config-prettier";

const eslintConfig = defineConfig([
  prettierConfig,
  globalIgnores(["dist/**", ".next/**"]),
  {
    rules: {
      "padding-line-between-statements": [
        "warn",
        {
          blankLine: "always",
          prev: "*",
          next: "return",
        },
        {
          blankLine: "always",
          prev: "*",
          next: "if",
        },
        {
          blankLine: "always",
          prev: ["const", "let", "var"],
          next: "*",
        },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
        // Force blank lines around functions
        {
          blankLine: "always",
          prev: "*",
          next: "function",
        },
        {
          blankLine: "always",
          prev: "function",
          next: "*",
        },
      ],
    },
  },
]);

export default eslintConfig;
