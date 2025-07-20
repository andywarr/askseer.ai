import { build } from "esbuild";

build({
  entryPoints: ["src/server.ts"],
  outfile: "build/server.cjs",
  bundle: true,
  minify: process.env.NODE_ENV === "production", // Only minify in production
  platform: "node",
  target: "node22", // More specific Node target
  format: "cjs", // Keep CJS for Node.js compatibility
  sourcemap: true,
  // Add path resolution for @ imports
  alias: {
    "@": process.cwd() + "/../..",
  },
  define: {
    "process.env.NODE_ENV": `"${process.env.NODE_ENV || "development"}"`,
  },
  logLevel: "info",
  // External dependencies that shouldn't be bundled
  external: [
    "aws-sdk",
    "pino",
    "pino-pretty",
    "@prisma/client",
    ".prisma/client",
  ],
}).catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
