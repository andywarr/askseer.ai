import { build } from "esbuild";

build({
  entryPoints: ["src/server.ts"], // Your entry point (you can add more .ts files here)
  outfile: "build/server.cjs",
  bundle: true, // Bundle all dependencies into a single file
  minify: true, // Minify the output
  platform: "node", // Target environment
  target: "esnext", // Target latest JavaScript features
  format: "cjs", // Use ESModules for Node.js
  sourcemap: true, // Optional: Enable source maps
}).catch(() => process.exit(1)); // Catch errors and exit if they occur