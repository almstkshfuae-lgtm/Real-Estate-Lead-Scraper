# Deployment and Database Migration Guide

This repository now uses Railway MySQL only. The Prisma schema is `prisma/schema.prisma` and it must be driven by `DATABASE_URL` in both development and production.

## Philosophy
- Development and production must use MySQL via Railway.
- Do not use SQLite anywhere in this repo or deployment flow.
- Keep `DATABASE_URL` set to a valid MySQL connection string for all Prisma operations.

## Vercel environment variables (Project → Settings → Environment Variables)
- `DATABASE_PROVIDER` = `mysql`
- `DATABASE_URL` = your Railway MySQL connection string, for example:
  - `mysql://username:password@host:3306/database_name`
- `NODE_ENV` = `production`

Note: Do not set `DATABASE_URL` to a `file:` path.

## Prisma schema
- Use `prisma/schema.prisma` for all Prisma commands.
- There is no SQLite schema in active use.

## Recommended deployment workflow

1. Create and commit migrations using MySQL.

```bash
export DATABASE_URL="mysql://root:root@127.0.0.1:3306/realestate"
npx prisma migrate dev --schema=prisma/schema.prisma --name init
```

2. Push code and migrations.

3. Apply migrations in production:

```bash
npx prisma migrate deploy --schema=prisma/schema.prisma --url="$DATABASE_URL"
```

Optional Vercel build command:

```bash
npm run build && npx prisma migrate deploy --schema=prisma/schema.prisma
```

## If you cannot run MySQL locally
- Use Railway with `DATABASE_URL` set to your Railway MySQL string.
- Run migrations directly against Railway using the same `prisma/schema.prisma` schema.

## Quick checks to avoid problems
- Confirm `prisma/schema.prisma` uses `provider = "mysql"`.
- Confirm `DATABASE_URL` is a MySQL URL in both local and production environments.
- Do not leave any `file:` database URLs in env files or deployment settings.

## Troubleshooting
- If Prisma complains about missing tables, run:

```bash
npx prisma migrate status --schema=prisma/schema.prisma --url="$DATABASE_URL"
```

- If you need migration help, provide a Railway MySQL connection string or run a local MySQL instance and commit the generated migrations.
