import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/vanaraksha-final/",
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    allowedHosts: ["snowy-unseated-gimmick.ngrok-free.dev"],
  },
  build: { outDir: "dist" },
});
