# Seer

Seer is an AI-powered insight platform for product teams. It is designed to help product teams generate insights, and evaluate workflows with ease.

## Monorepo Structure

This project is a monorepo managed with Yarn Workspaces (Yarn v4).

- **`apps/nextjs-app`**: The primary user-facing web application built with Next.js, React 19, and TailwindCSS.
- **`apps/ai-worker`**: A backend worker handling AI execution, evaluations, and background processing using OpenAI APIs.
- **`apps/db-worker`**: A database worker performing asynchronous database tasks, billing operations, and Resend email dispatches.
- **`apps/cron-worker`**: A scheduler that triggers recurring tasks, notifications, and reminders.
- **`apps/db`**: Dedicated Prisma schema and database migration manager.
- **`apps/figma-plugin`**: Figma integration for exporting frames/pages directly to Seer for analysis.
- **`packages/ai-release-notes`**: Utility packages for generating AI release notes.

## Prerequisites

Before starting, make sure you have the following installed:
- [Node.js](https://nodejs.org/) v22+
- [Yarn](https://yarnpkg.com/) v4+
- [PostgreSQL](https://www.postgresql.org/) database

---

## Getting Started

### 1. Clone the repository and install dependencies
```bash
git clone git@github.com:andywarr/askseer.ai.git
cd askseer.ai
yarn install
```

### 2. Configure Environment Variables
You need to copy the `.env.example` templates to `.env` or `.env.local` files inside each app directory and fill in the required API keys and settings.

* **Next.js Web App**: Copy `apps/nextjs-app/.env.example` to `apps/nextjs-app/.env.local`
* **AI Worker**: Copy `apps/ai-worker/.env.example` to `apps/ai-worker/.env`
* **DB Worker**: Copy `apps/db-worker/.env.example` to `apps/db-worker/.env`
* **Cron Worker**: Copy `apps/cron-worker/.env.example` to `apps/cron-worker/.env`

See the individual `.env.example` files for details on what keys are required (Google OAuth, OpenAI, Stripe, AWS, Resend, LiveKit, Figma).

### 3. Database Setup
Set your `DATABASE_URL` in your Next.js and DB Worker environment configuration, then run:
```bash
# Generate Prisma Client
yarn workspace @askseer/db db:generate

# Run migrations
yarn workspace @askseer/db db:migrate
```

### 4. Running the Development Servers
You can run the different services of the monorepo concurrently or individually using root-level workspace commands.

```bash
# Run Next.js Web App
yarn dev:web

# Run AI Worker
yarn dev:ai

# Run DB Worker
yarn dev:db

# Run Cron Worker
yarn dev:cron
```

---

## License

This software is licensed under the **PolyForm Noncommercial License 1.0.0**. 

You are free to use, modify, and share this software for non-commercial purposes (personal use, study, testing, non-profit or research purposes). Any commercial use, including running it on behalf of a commercial business or using it to generate monetary compensation, is strictly prohibited. For the full terms, see the [LICENSE](LICENSE) file.
