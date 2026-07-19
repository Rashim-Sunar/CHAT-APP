import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Base64-inline the small default avatar images (male.png, female-avatar.jpg) into the
    // JS bundle so the fallback avatar paints immediately instead of waiting on a separate
    // network request after first render.
    assetsInlineLimit: 20000,
  },
  server: {
    host: true, // bind 0.0.0.0 so the dev server is reachable from outside the container
    port: 3000,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
      },
    },
  },
});