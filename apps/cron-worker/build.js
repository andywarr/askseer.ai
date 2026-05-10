import { build } from "esbuild";

build({
  entryPoints: ["src/server.ts"],
  outfile: "build/server.cjs",
  bundle: true,
  minify: process.env.NODE_ENV === "production",
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: true,
  alias: {
    "@": process.cwd() + "/../..",
  },
  logLevel: "info",
  external: ["pino", "node-cron"],
}).catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
