import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/StylesTargetReact.tsx"],
  external: ["lightningcss", "react", "react-dom", "vue", "vite", "node:crypto", "node:path"],
  define: {
    "process.env.CSS_TRANSFORMER_WASM": "false",
  },
  minify: true,
  sourcemap: true,
});
