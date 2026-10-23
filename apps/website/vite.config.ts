import { defineConfig } from "vite-plus";

export default defineConfig(({ command, mode }) => ({
  base: mode === "desktop" ? "./" : command === "build" ? "/FaceScan-ISC/" : "/",
  build: {
    outDir: mode === "desktop" ? "dist/desktop" : "../../docs",
    emptyOutDir: true,
  },
}));
