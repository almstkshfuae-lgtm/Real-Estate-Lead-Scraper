---
description: Use for every new page, component, API route, or tracker task.
---

## Plan before acting
State explicitly before writing any code:

Which files will be created or modified.
Which i18n keys will be added (list them all).
Whether a Prisma schema change is needed.
Whether a new API route is needed.
Whether any package needs to be installed.

Do not write code until this plan is stated.

## Implementation order — always follow this sequence
1. Prisma schema change (if needed) → migration → generate   [Section 7]
2. lib utility functions
3. API route(s)                                               [Section 8]
4. Component(s)                                               [Section 9]
5. Page
6. i18n keys — EN first, AR immediately after, same commit 
 
## Build verification — required after every change
bashnpm run build
Read every line. Do not proceed if there are type errors, missing imports, export issues, or missing await on async Next.js APIs. Fix, rebuild, confirm pass. Never deploy a failing build.

 
## Deploy
bashvercel --prod
Immediately after "Deployment complete", check build logs:
bashvercel logs <deployment-url> --output raw
Or via Vercel MCP — always pass:

projectId: prj_uGOo1TrHwzwp8DU1wqQpV9ihFdHs
teamId: team_9P7hpSywx6RCFmh3dDyKc6e2
Use get_deployment_build_logs first, then get_runtime_logs for function errors.

"Deployment complete" does not mean the feature works. Read the logs.
4.5 Runtime verification — required before marking done
Open the live URL in browser. Confirm all of:

 Feature works in English (LTR)
 Feature works in Arabic (RTL) — layout mirrors, text is Arabic, not placeholders
 Browser console: zero errors, zero missing translation key warnings
 Network tab: all API calls return 2xx
 Dark mode toggled: colors correct, no hardcoded hex visible
 Vercel function logs: no runtime crashes

## Close out

Mark task ✅ Done in tracker.md, commit it.
Report (all five required — see Section 11).

