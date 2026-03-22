import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      ".git/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"]
    }
  },
  {
    files: ["**/*.test.ts", "**/tests/**/*.ts", "**/vitest.config.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest
      }
    }
  }
);
