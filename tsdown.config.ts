import { defineConfig } from "tsdown";

export default defineConfig({
  // ...config options
  external: ["lighningcss", "react", "react-dom", "vite"],
  define: {
    "process.env.CSS_TRANSFORMER_WASM": "false",
  },
});
