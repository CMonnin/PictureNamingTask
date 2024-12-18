import * as path from "path";

import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE || "/PictureNamingTask/",
  build: {
    target: "es2022", //browsers can handle the latest ES features
  },
  resolve: {
    alias: {
      "/runtime/v1": path.resolve(
        import.meta.dirname,
        "./node_modules/@opendatacapture/runtime-v1/dist",
      ),
    },
  },
});
