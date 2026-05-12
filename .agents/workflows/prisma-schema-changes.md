---
description: Every change to prisma/schema.prisma requires this full sequence
---

Every change to prisma/schema.prisma requires this full sequence. Never skip steps.
1 Edit schema — rules

Every new model: @id, @default(cuid()), createdAt DateTime @default(now())
Every FK column: corresponding @@index
Long strings (notes, URLs, content): use @db.Text — plain String = VARCHAR(191), it truncates
Optional fields use ? — never make a field required if existing rows won't have the value

2 Create migration
bashnpx prisma migrate dev --name <descriptive-name>
# e.g.: add_export_history_table | add_bitrix24_id_to_lead | add_preferences_to_user
Open the generated prisma/migrations/<timestamp>/migration.sql. Read it. Confirm the SQL is correct.
3 Verify local DB
bashnpx prisma db pull   # must match schema.prisma
npx prisma studio    # optional: visually confirm new table/columns
4 Test locally
Run the feature using the new schema. Confirm no Prisma errors. Data saves and retrieves correctly.
5 Commit the migration
bashgit add prisma/schema.prisma prisma/migrations/
git commit -m "prisma: <descriptive-name>"
The migration file must be committed. Without it, the Vercel build fails or the app crashes at runtime.
6 Deploy and migrate production
bashvercel --prod

# After deployment — migrate the Railway production DB:
npx prisma migrate deploy
# (Use DATABASE_URL pointing to Railway — MYSQL_PUBLIC_URL from .env.vercel)
7 Verify production DB
bashnpx prisma db pull   # confirm pulled schema matches schema.prisma
If they don't match: migration did not apply fully. Check Railway logs for SQL errors.
8 Forbidden

prisma db push in production — destroys migration history
Skipping npx prisma generate — Prisma client out of sync, runtime crashes
Skipping npx prisma migrate deploy — production DB missing new fields, app crashes