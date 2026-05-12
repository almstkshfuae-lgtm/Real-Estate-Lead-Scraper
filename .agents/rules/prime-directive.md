---
trigger: always_on
---

Never claim something works until terminal output, logs, or browser confirmation proves it.

If a tool is available (Vercel MCP, Railway CLI, Prisma CLI, browser devtools) — use it.
Silence is not success. "It should work" is not verification.
Guessing at an error without reading the actual log is a rule violation.
If verification cannot be performed, say so explicitly. Never pretend it was done.


1. ORIENTATION — DO THIS FIRST, EVERY SESSION
Before writing a single line of code:
Step 1.1 — Read the tracker
Open tracker.md. Read it fully. Identify:

The current active phase: the lowest-numbered phase that has any 🔲 Todo item.
The exact task ID to work on next (e.g. 9A.2).
Whether the previous phase is fully ✅ Done. If not, stop and report before proceeding.

Step 1.2 — Read the design system
Open design_system.md. Read the sections relevant to what is being built:

Section 2 (Colors) — for any UI work
Section 3 (Typography) — for any text/font work
Section 6 (Components) — if building a button, input, table, sidebar, badge
Section 7 (Layout / RTL rules) — for any layout work
Section 14/15 (Map/AI) — for map or AI features

Step 1.3 — Confirm stack constraints
Open README.md. Confirm the Next.js version behavior applies to the task.
Step 1.4 — Ask before assuming
Before touching any component, lib, or route file — ask to see its current contents. Do not assume what is in a file.

2. TRACKER RULES
tracker.md is the source of truth. It controls what gets built and in what order.

Do not implement Phase N+1 tasks while Phase N has any 🔲 Todo items.
Work tasks in the order they appear within a phase. Do not cherry-pick.
When starting a task, mark it 🔄 In progress in tracker.md and commit that change first.
When a task is complete and verified, mark it ✅ Done immediately.
If blocked, mark ⏸ Blocked and state the exact blocker. Do not silently skip.
Do not invent tasks outside the tracker. Propose additions — wait for confirmation before implementing.

Phase order (never skip):
0 Foundation → 1 Auth → 2 Search → 3 Scraper → 4 Pipeline → 5 Map → 6 AI → 7 Scraper Service → 8 Export → 9 CRM → 10 Settings → 11 PWA

3. NEXT.JS 16.2 — HARD CONSTRAINTS
Violating any of these causes build failure or silent runtime breakage.
ConstraintRuleNo middleware.tsUse proxy.ts. Export function as proxy, not middleware.No webpack configTurbopack is default. Never add webpack() to next.config.js.cookies() is asyncAlways await cookies()headers() is asyncAlways await headers()params is asyncAlways await params in route handlers and pagessearchParams is asyncAlways await searchParamsNo next lintUse npx biome check . or npx eslint . directlyNo experimental.pprUse "use cache" directive instead"use cache" is explicitNo implicit fetch/route caching. Add "use cache" at top of anything that should cache.No reactCompiler: trueLeave off — it increases compile time, not enabled by default