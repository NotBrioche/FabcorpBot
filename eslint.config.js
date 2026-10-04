import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["src/**.*"],
    rules: {
      semi: "error",
      "prefer-const": "error"
    }
  }
]);
