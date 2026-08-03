import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "cursor/canvas": path.resolve(__dirname, "src/cursor/canvas.tsx"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
});
