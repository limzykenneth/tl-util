import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix"
  },
  fmt: {
    ignorePatterns: [],
    printWidth: 80,
    trailingComma: "none"
  },
  lint: {
    rules: {
      "typescript/restrict-template-expressions": {
        allowAny: true
      }
    },
    env: {
      builtin: true
    },
    globals: {},
    ignorePatterns: [],
    options: {
      typeAware: true,
      typeCheck: true
    }
  },
  test: {
    includeSource: ["src/**/*.{js,ts}"]
  },
  pack: {
    dts: {
      tsgo: true
    },
    define: {
      "import.meta.vitest": "undefined"
    }
  }
});
