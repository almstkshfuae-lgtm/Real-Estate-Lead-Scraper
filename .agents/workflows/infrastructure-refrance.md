---
description: Vercel MCP — always pass these identifiers:
---

Vercel MCP — always pass these identifiers:

projectId: prj_uGOo1TrHwzwp8DU1wqQpV9ihFdHs
teamId: team_9P7hpSywx6RCFmh3dDyKc6e2
Build failures → get_deployment_build_logs first
Runtime errors → get_runtime_logs

Railway — production MySQL:

Internal URL: mysql.railway.internal:3306 (used by Vercel at runtime)
Public URL: viaduct.proxy.rlwy.net:33196 (used for local prisma migrate deploy)
DB name: railway
After any migration: run npx prisma migrate deploy using the public URL before considering the deployment done

Environment variable sync:

Vercel and Railway do not sync env vars automatically.
After adding a var to Railway: add it to Vercel via vercel env add or the dashboard.
After adding to Vercel: redeploy for it to take effect.
Confirm DATABASE_URL is present in both before any DB-related deployment.