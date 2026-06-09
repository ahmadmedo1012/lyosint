import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT ?? "19190");
const basePath = process.env.BASE_PATH ?? "/";
const isProduction = process.env.NODE_ENV === "production";
const isReplitDev = !isProduction && process.env.REPL_ID !== undefined;

const replitPlugins = isReplitDev
  ? [
      (await import("@replit/vite-plugin-cartographer")).cartographer({
        root: path.resolve(import.meta.dirname, ".."),
      }),
      (await import("@replit/vite-plugin-dev-banner")).devBanner(),
      (await import("@replit/vite-plugin-runtime-error-modal")).default(),
    ]
  : [];

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), ...replitPlugins],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: isProduction
    ? undefined
    : {
        port,
        strictPort: true,
        host: "0.0.0.0",
        allowedHosts: true,
        fs: { strict: true },
      },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
