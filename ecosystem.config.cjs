const path = require("path");

module.exports = {
  apps: [
    {
      name: "seer-web",
      cwd: path.resolve(__dirname, "apps/nextjs-app"),
      script: path.resolve(__dirname, "node_modules/next/dist/bin/next"),
      args: "start",
      node_args: "--max-old-space-size=3072",
      max_memory_restart: "2500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "seer-db",
      cwd: path.resolve(__dirname, "apps/db-worker"),
      script: path.resolve(__dirname, "apps/db-worker/build/server.cjs"),
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
    {
      name: "seer-ai",
      cwd: path.resolve(__dirname, "apps/ai-worker"),
      script: path.resolve(__dirname, "apps/ai-worker/build/server.cjs"),
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "seer-cron",
      cwd: path.resolve(__dirname, "apps/cron-worker"),
      script: path.resolve(__dirname, "apps/cron-worker/build/server.cjs"),
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
