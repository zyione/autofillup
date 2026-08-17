import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(projectRoot, "src/content/content.ts"),
      name: "AutoFillUpContent",
      formats: ["iife"],
      fileName: () => "assets/content.js"
    }
  }
});
