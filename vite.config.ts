import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  base: "/uberden-halloween/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
