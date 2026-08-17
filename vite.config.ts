import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const entryName = (id: string): string => {
  if (id.endsWith("service-worker.ts")) return "service-worker";
  return "[name]";
};

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(projectRoot, "src/popup/popup.html"),
        options: resolve(projectRoot, "src/options/options.html"),
        "service-worker": resolve(projectRoot, "src/background/service-worker.ts")
      },
      output: {
        entryFileNames: (chunk) => `assets/${entryName(chunk.facadeModuleId ?? "")}.js`,
        chunkFileNames: "assets/chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
