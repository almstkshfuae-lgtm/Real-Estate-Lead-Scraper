# Deployment and Database Migration Guide

This document explains how to keep local development on SQLite and deploy to production using Railway MySQL (via Vercel). It includes exact environment variables, recommended commands, and safe migration steps.

## Philosophy
- Local development: use SQLite (`DATABASE_URL="file:./prisma/local-dev.db"`).
- Production: use MySQL (Railway). Keep DBs separate — do NOT point production to a local file.

## Vercel environment variables (Project → Settings → Environment Variables)
- `DATABASE_PROVIDER` = `mysql`
- `DATABASE_URL` = your Railway MySQL connection string (example):
  - `mysql://username:password@host:3306/database_name`
- `NODE_ENV` = `production`

Note: Do NOT set `DATABASE_URL` in Vercel to a `file:` path.

## Which Prisma schema to use
- For local dev keep `prisma/schema.prisma` (SQLite datasource) as is.
- For MySQL use `prisma/schema.mysql.prisma` for migration commands and `prisma migrate deploy` in CI/production.

## Recommended deployment workflow (safe)

1. Create MySQL migrations locally (recommended using a local/test MySQL instance or a temporary Railway branch):

```bash
# Example: start a local MySQL docker container (optional)
docker run --name prisma-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=realestate -p 3306:3306 -d mysql:8 --default-authentication-plugin=mysql_native_password

# Point Prisma at that MySQL while creating migrations
export DATABASE_URL="mysql://root:root@127.0.0.1:3306/realestate"

# Use the MySQL schema file to create migrations
npx prisma migrate dev --schema=prisma/schema.mysql.prisma --name init

# Commit the generated migrations (they will be in prisma/migrations)
git add prisma/migrations && git commit -m "Add MySQL migrations"
```

2. Push code & migrations to GitHub.

3. On production (Railway / Vercel) apply migrations (recommended via CI or one-off remote command):

```bash
# Run from CI or your machine with DATABASE_URL set to Railway connection
npx prisma migrate deploy --schema=prisma/schema.mysql.prisma --url="$DATABASE_URL"
```

Alternative: include a deployed migration step in your Vercel build command (less ideal because builds should be idempotent):

```
# Vercel Build Command (example)
npm run build && npx prisma migrate deploy --schema=prisma/schema.mysql.prisma
```

## If you cannot run MySQL locally
- You can run migrations directly against Railway (CI or locally) by setting `DATABASE_URL` to the Railway connection string and running `npx prisma migrate dev --schema=prisma/schema.mysql.prisma --name init`.
- If you prefer, provide the Railway MySQL connection string and I can generate the MySQL migrations for you and add them to the repo.

## Quick checks to avoid problems
- Verify `prisma/schema.prisma` and `prisma/schema.mysql.prisma` both reference `env("DATABASE_URL")`.
- Ensure you do not accidentally commit a `DATABASE_URL` secret.
- Confirm the migrations directory contains MySQL-compatible SQL before running `migrate deploy` on production.

## Troubleshooting
- If Prisma complains about missing tables after deploy, run `npx prisma migrate status --schema=prisma/schema.mysql.prisma --url="$DATABASE_URL"` to see which migrations were applied.
- If you need me to produce migrations, share a Railway connection string (or temporary credentials) OR follow the Docker-based local flow above and commit the generated migrations. I will then review and finish the deployment steps.

---
If you want me to generate and commit MySQL migrations now, provide a Railway MySQL connection string or allow me to use a temporary MySQL instance you control. Otherwise, run the Docker steps above locally and push the generated migrations.
