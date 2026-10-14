import { defineConfig } from "vite-plus";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/FaceScan-ISC/" : "/",
  build: {
    outDir: "../../docs",
    emptyOutDir: true,
  },
}));
