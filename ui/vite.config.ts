import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [preact()],
  build: { outDir: "dist", emptyOutDir: true },
});
