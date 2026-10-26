const path = require("path");

module.exports = {
  apps: [
    {
      name: "seer-web",
      cwd: path.resolve(__dirname, "apps/nextjs-app"),
      script: path.resolve(__dirname, "node_modules/next/dist/bin/next"),
      args: "start",
      instances: 2,
      exec_mode: "cluster",
      node_args: "--max-old-space-size=2560",
      max_memory_restart: "3200M",
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "seer-db",
      cwd: path.resolve(__dirname, "apps/db-worker"),
      script: path.resolve(__dirname, "apps/db-worker/build/server.cjs"),
      instances: 2,
      exec_mode: "cluster",
      node_args: "--max-old-space-size=1024",
      max_memory_restart: "1500M",
      wait_ready: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
    {
      name: "seer-ai",
      cwd: path.resolve(__dirname, "apps/ai-worker"),
      script: path.resolve(__dirname, "apps/ai-worker/build/server.cjs"),
      max_memory_restart: "1000M",
      node_args: "--max-old-space-size=768",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "seer-cron",
      cwd: path.resolve(__dirname, "apps/cron-worker"),
      script: path.resolve(__dirname, "apps/cron-worker/build/server.cjs"),
      max_memory_restart: "300M",
      node_args: "--max-old-space-size=256",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
