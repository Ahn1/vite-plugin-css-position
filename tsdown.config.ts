import { defineConfig } from "tsdown";

export default defineConfig({
  // ...config options
  entry: ["src/index.ts", "src/StylesTarget.tsx", "src/StylesTarget.vue"],
  external: ["lighningcss", "react", "react-dom", "vue", "vite"],
  define: {
    "process.env.CSS_TRANSFORMER_WASM": "false",
  },
  minify: true,
  sourcemap: true,
});
