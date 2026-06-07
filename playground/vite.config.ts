import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import viteReactCssPosition from "../src/viteCustomCssPosition";

export default defineConfig({
  root: "./playground",
  plugins: [viteReactCssPosition({ lazy: true }), react()],
});
