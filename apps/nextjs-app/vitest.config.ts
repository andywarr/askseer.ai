import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import * as path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["components/**/*.tsx"],
      exclude: ["**/*.test.tsx"],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../.."),
      "server-only": path.resolve(__dirname, "./vitest.server-only-mock.ts"),
      "next/server": path.resolve(__dirname, "./vitest.next-server-mock.ts"),
    },
  },
});
