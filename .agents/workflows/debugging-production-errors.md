---
description: 
---

Never guess. Read the actual error first.
1 Symptom → step
SymptomGo toPage blank / white screen6.2API route returns 5006.3UI broken — missing text or wrong layout6.4Works in EN, broken in AR6.5Build fails on Vercel6.6DB / Prisma error6.7
2 Blank / white screen
bash# Browser DevTools → Console. Read the full error first.
# Then read Vercel function logs:
vercel logs <deployment-url> --output raw
# Or Vercel MCP: get_runtime_logs(projectId, teamId)
Common causes:

await missing on cookies(), headers(), params, searchParams → add await
Client component importing server-only module → move import or use dynamic import
Missing "use client" on component using hooks → add the directive
Map/chart imported without { ssr: false } → wrap in dynamic() with ssr: false in the parent page

Fix the exact error shown. Do not refactor unrelated code.
3 API route returns 500
bashcurl -X GET https://<domain>/api/<route> -H "Cookie: auth_token=<token>" -v
vercel logs <deployment-url> --output raw
Prisma errors in the log:

PrismaClientInitializationError → DB unreachable → check Railway status and DATABASE_URL in Vercel env
PrismaClientKnownRequestError → field missing in DB → migration not deployed → run npx prisma migrate deploy
PrismaClientValidationError → field name typo in query → fix the field name in code

bashrailway status
railway logs
vercel env ls   # confirm DATABASE_URL exists in Vercel environment
4 UI broken — missing text or wrong layout
bash# Browser console — look for: "Missing translation: common.xxx"
Run the i18n completeness script from Section 5.2. Fix all missing AR keys.
For layout issues: DevTools → Elements → Computed. Find margin-left, padding-right, left:, right:, text-align: left. Replace each with the logical equivalent in source.
5 Works in EN, broken in AR
Check each of these in browser with Arabic active:

 <html dir="rtl"> — not set on a child element
 No margin-left, padding-right, left:, right: in component computed styles
 Directional icons are mirrored (.rtl-mirror)
 Sidebar is on the correct side (left in AR)
 Arabic translation values are actual Arabic — not English or empty strings
 Arabic font (font-cairo) is active

Fix each item. Verify in browser after each fix individually.
6 Build failure on Vercel
bashvercel logs <deployment-url> --output raw
# Or Vercel MCP: get_deployment_build_logs(projectId, teamId)
npm run build   # reproduce locally
Read the error exactly:

Type error → fix the mismatch shown
Module not found → check import path and package.json
cookies() not awaited → add await
Webpack config conflict → remove webpack() from next.config.js
Wrong middleware export → rename to proxy.ts, export proxy

Fix, run npm run build locally until clean, then deploy.
7 DB / Prisma error
bashrailway status
railway logs --tail 100
npx prisma db pull
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
vercel --prod
After fixing: confirm in Vercel function logs that the Prisma error is gone.