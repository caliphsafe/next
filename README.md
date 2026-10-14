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

Client names, financial details, and personal schedule overrides are excluded from this public repository. Split a validated State JSON object into server-only secrets `INITIAL_WORKSPACE_JSON_1`, `_2`, and `_3` (each under the hosting value-size limit) when provisioning a private instance. It initializes an authenticated user’s workspace once; subsequent edits are stored in D1. Without it, new accounts start with an empty project list. Never put that value in client code, Git, or a NEXT_PUBLIC environment variable.

### Campaign rotation and ChatGPT co-op

Weekdays rotate across 3 eligible campaigns by default (adjustable from 2–5). Priority chooses the roster and initial order; each campaign receives one block before the rotation repeats. Gentle/Balanced/Focused caps are 25/40/50 minutes with 10-minute breaks. Existing shower, meals, shutdown, dependency, and studio rules still apply; a short day can fit fewer campaigns. Music remains in studio blocks.

Campaigns support a saved ChatGPT conversation title/link, dated recap, next step, and a copyable handoff prompt. This is **not automatic chat-history synchronization**. Update the recap after a conversation. Optional assisted task estimates replace solo estimates only in ChatGPT mode; otherwise the original estimate is used. Include review/testing time. Log a focus block to record elapsed effort and move the rotation forward without completing the mission. Logged minutes count against daily capacity and remaining estimates; an unfinished task stays visible even after exceeding its estimate. The timeline reflows as a capacity plan, not an exact historical calendar.

Legacy workspace JSON receives defaults on read. Optional secret `PROJECT_CONTEXT_JSON` provides per-project initial conversation context and explicitly labeled planning estimates for existing missions; it applies only before a conversation record has been saved. User edits remain authoritative. No private conversation content belongs in the public source repository.

### Live daily queue

Today's dashboard schedules from the current New York time and recalculates immediately after local completion or ranking changes, and as each minute passes. It fills available weekday work time through 4:15 p.m., then preserves the existing shutdown through 5 p.m.; the focus-hours setting remains the target for other dates' forecasts. Completed tasks are shown in the wins ledger rather than reserving their old estimated durations in today's upcoming timeline. A timestamped completion protects a 10-minute recovery break. Lunch, studio, blocked/waiting campaigns, and weekends retain their existing rules.

The rotation size limits concurrent campaigns, not the entire day's roster: as a campaign's estimated queue empties, the next eligible ranked campaign enters. A running timer is pinned while upcoming work recalibrates. Explicit rank changes override a prior rotation. No task is automatically marked done. Actual cross-device saved updates are polled every 15 seconds while visible and when the tab regains focus; active edits are protected and revision checks prevent overwriting concurrent saves. This is polling, not server-pushed synchronization.
