import { defineConfig } from "vitest/config";
import * as path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@/apps/db-worker": path.resolve(process.cwd(), "."),
      "@/apps/shared": path.resolve(process.cwd(), "../shared"),
    },
  },
});
