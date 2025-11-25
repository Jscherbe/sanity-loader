import globals from "globals";
import js from "@eslint/js";

const baseConfig = {
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    globals: {
      ...globals.node,
    },
  },
  rules: {
    "indent": ["warn", 2, { "SwitchCase": 1 }],
    "quotes": ["warn", "double"],
    "semi": ["warn", "always"],
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
  }
};

export default [
  {
    ignores: [
      "node_modules/", 
      "docs/", 
      "types/", 
      "tests/sanity-database/"
    ],
  },
  js.configs.recommended,
  {
    // Config for library files
    files: ["lib/**/*.js"],
    ...baseConfig
  },
  {
    // Config for test files
    files: ["tests/utils.js", "tests/**/*.test.js"],
    ...baseConfig,
    languageOptions: {
      ...baseConfig.languageOptions,
      globals: {
        ...baseConfig.languageOptions.globals,
        ...globals.vitest,
      },
    },
  },
];
