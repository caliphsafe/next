# NEXT — your next chapter

Private personal planner with: daily missions, client campaigns, creative time, routines, a brain-dump inbox, priority recalibration, income tracking, and XP progression.

## Current runtime

The working private deployment uses the Sites Vinext/React runtime, ChatGPT sign-in, and a Cloudflare D1 database. Source is mirrored to `caliphsafe/next`. **This runtime is not a standard Vercel Next.js deployment.** Vercel deployment is pending an accessible team/project and a portable authentication/database adapter; do not import this repository into Vercel expecting its Cloudflare bindings to work unchanged.

## Development

Node 22.13+ and pnpm are required. No package-lock.json is used.

- `pnpm install --frozen-lockfile`
- `pnpm dev`
- `pnpm build`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node --experimental-strip-types --test tests/planner.test.mjs`

The Sites runtime helpers manage hosting and authenticated deployment. `.openai/hosting.json` retains the Site identity. `db/schema.ts` and `drizzle/` define the database schema; apply the migration before serving the API. Workspaces are keyed by authenticated user ID, and revision checks prevent silent cross-device overwrites.

## Application map

- `app/dashboard.tsx` — responsive application and editable forms.
- `app/globals.css` — visual system and mobile layouts.
- `lib/model.ts` — initial projects, validation, priority scoring, scheduling, and formatting.
- `app/api/state/route.ts` — authenticated persistence with optimistic concurrency.
- `app/chatgpt-auth.ts` — hosting-provided identity helpers.
- `db/` and `drizzle/` — durable storage and migrations.
- `tests/planner.test.mjs` — scheduling and data integrity tests.

## Planning behavior

- All dates use America/New_York.
- Work ends by 5 p.m. and is capped by the selected focused-work capacity.
- Shower starts by 7:15 a.m. or at/after 10 a.m.
- Proposed workout days: Monday, Wednesday, Friday.
- Studio defaults: Tuesday/Thursday 6–10 p.m., Saturday 10 a.m.–2 p.m.
- A special studio date and a skipped session can be configured privately in Settings.
- Priority boosts and custom order change the flexible work queue, preserving routines and studio time.
- Waiting, paused, finished, and dependency-blocked campaigns do not receive new work blocks.
- Task durations and target dates are editable planning estimates.
- Future days are forecasts from the current queue; they recalculate as missions are completed.
- Payments are recorded separately from completion. Potential income is never treated as collected.
- Reminders are in-app. The focus timer runs in the current tab; no background notifications or calendar invitations are created.

## Verification

Production bundle and TypeScript checks pass. Planner tests cover financial seed values, priority recalibration, dependency locks, schedule non-overlap, shower windows, work cutoff, capacity, and special studio overrides. Interactive browser QA was unavailable in the build environment.

## Private initial data

Client names, financial details, and personal schedule overrides are excluded from this public repository. Set the server-only secret `INITIAL_WORKSPACE_JSON` to a validated State object when provisioning a private instance. It initializes an authenticated user’s workspace once; subsequent edits are stored in D1. Without it, new accounts start with an empty project list. Never put that value in client code, Git, or a NEXT_PUBLIC environment variable.
