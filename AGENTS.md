# AGENTS.md

## Overview
- Project: `metarx`
- Type: Vite + React 19 + TypeScript single-page app with small serverless/API handlers.
- Purpose: fetch, decode, compare, and summarize METAR weather reports, with an optional LLM-backed pilot-analysis panel.

## Stack
- Frontend: React, TypeScript, Vite, Framer Motion, Lucide, `react-markdown`
- Testing: Vitest, Testing Library, JSDOM, V8 coverage
- Server/runtime: Vite dev middleware plus API handlers under `api/` and shared server helpers under `server/`

## Common Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Unit tests: `npm test`
- Coverage: `npm run test:coverage`
- Production build: `npm run build`

## Quality Gates
- Keep these green before committing:
  - `npm run lint`
  - `npm test`
  - `npm run test:coverage`
  - `npm run build`
- Coverage thresholds are enforced in [`vite.config.ts`](/Users/tonyc/src/metarx/vite.config.ts) at `80/80/80/80`.

## Repository Layout
- [`src/App.tsx`](/Users/tonyc/src/metarx/src/App.tsx): top-level shell and composition layer
- [`src/components/`](/Users/tonyc/src/metarx/src/components): UI sections and briefing panels
- [`src/hooks/`](/Users/tonyc/src/metarx/src/hooks): stateful lookup and pilot-analysis logic
- [`src/lib/`](/Users/tonyc/src/metarx/src/lib): domain logic, copy, storage, theme, parser helpers
- [`server/`](/Users/tonyc/src/metarx/server): shared server-side handlers/helpers
- [`api/`](/Users/tonyc/src/metarx/api): API entrypoints used in deployment

## Current Architecture
- METAR lookup behavior is shared between dev and deployed runtimes through [`server/metar.ts`](/Users/tonyc/src/metarx/server/metar.ts).
- Pilot-analysis request handling is decomposed into:
  - [`server/pilotAnalysis.ts`](/Users/tonyc/src/metarx/server/pilotAnalysis.ts)
  - [`server/pilotAnalysis/request.ts`](/Users/tonyc/src/metarx/server/pilotAnalysis/request.ts)
  - [`server/pilotAnalysis/rateLimit.ts`](/Users/tonyc/src/metarx/server/pilotAnalysis/rateLimit.ts)
  - [`server/pilotAnalysis/sse.ts`](/Users/tonyc/src/metarx/server/pilotAnalysis/sse.ts)
- Frontend orchestration is split into:
  - [`src/hooks/useMetarLookup.ts`](/Users/tonyc/src/metarx/src/hooks/useMetarLookup.ts)
  - [`src/hooks/usePilotAnalysis.ts`](/Users/tonyc/src/metarx/src/hooks/usePilotAnalysis.ts)
  - [`src/components/AnalysisPanel.tsx`](/Users/tonyc/src/metarx/src/components/AnalysisPanel.tsx)
  - [`src/components/briefings.tsx`](/Users/tonyc/src/metarx/src/components/briefings.tsx)
- METAR parsing is split into:
  - [`src/lib/metar.ts`](/Users/tonyc/src/metarx/src/lib/metar.ts): compat surface, NOAA mapping, watchouts
  - [`src/lib/metarRemarks.ts`](/Users/tonyc/src/metarx/src/lib/metarRemarks.ts): RMK and RVR parsing
  - [`src/lib/metarWeather.ts`](/Users/tonyc/src/metarx/src/lib/metarWeather.ts): weather token decoding
  - [`src/lib/metarShared.ts`](/Users/tonyc/src/metarx/src/lib/metarShared.ts): shared constants/types

## Environment Notes
- The pilot-analysis endpoint expects an OpenRouter API key via normal env configuration.
- Do not reintroduce hard-coded fallback `.env` paths outside this repo.
- The in-memory rate limiter is acceptable for local/small deployment use, but it is not distributed or durable.

## Working Conventions
- Prefer extending existing helpers and hooks over adding more logic back into `App`.
- Keep shared runtime behavior in `server/` and call it from both Vite middleware and `api/` entrypoints.
- Keep storage access behind the safe wrappers in [`src/lib/browserStorage.ts`](/Users/tonyc/src/metarx/src/lib/browserStorage.ts).
- Avoid coupling tests to animation timing or exact DOM structure when async rendering is involved.
- `coverage/` and `dist/` are generated outputs and should not be committed.

## What Was Done Recently
- Centralized duplicated METAR proxy behavior.
- Added request validation, origin checks, request-size limits, and simple rate limiting to pilot-analysis.
- Fixed stale lookup races by aborting or ignoring superseded lookup requests.
- Added fail-safe local-storage wrappers.
- Added and enforced real coverage thresholds.
- Removed starter/dead assets and some duplicated constants.
- Split `App` into hooks and components.
- Split METAR parsing into smaller modules.
- Lazy-loaded the markdown renderer so the initial client chunk no longer triggers the previous Vite size warning.

## Current Status
- The app is in decent shape for a small product repo.
- It is maintainable by a normal human engineer.
- It is reasonable to show to senior engineers without obvious embarrassment.
- Current verified baseline before the last commit:
  - lint passes
  - tests pass
  - coverage passes
  - build passes
  - overall coverage is roughly `89%` statements / `80%` branches / `95%` functions / `89%` lines

## Honest Remaining Caveats
- [`src/components/briefings.tsx`](/Users/tonyc/src/metarx/src/components/briefings.tsx) is still large. It is better than the old `App.tsx` situation, but it could be split further by panel type.
- [`src/lib/metarRemarks.ts`](/Users/tonyc/src/metarx/src/lib/metarRemarks.ts) is isolated and testable, but still dense. It is the next place a reviewer will call out for further decomposition.
- [`server/pilotAnalysis/sse.ts`](/Users/tonyc/src/metarx/server/pilotAnalysis/sse.ts) has weaker direct coverage than the rest of the server helpers.
- The in-memory pilot-analysis rate limiter is only a pragmatic safeguard, not production-grade abuse protection across multiple instances.
- Coverage is good enough and honestly enforced, but not exhaustive. Do not claim `100%`.

## Recommended Next Steps
- Split [`src/components/briefings.tsx`](/Users/tonyc/src/metarx/src/components/briefings.tsx) into smaller section components.
- Break [`src/lib/metarRemarks.ts`](/Users/tonyc/src/metarx/src/lib/metarRemarks.ts) into grouped parser modules if the remark surface keeps growing.
- Add direct tests for the SSE helper in [`server/pilotAnalysis/sse.ts`](/Users/tonyc/src/metarx/server/pilotAnalysis/sse.ts).
- If the app is deployed more broadly, replace the in-memory rate limiter with a shared backing store or edge/platform rate limiting.
- If bundle size matters further, audit `framer-motion` and large UI sections before adding new heavy client dependencies.

## Do Not Regress
- Do not move complex orchestration back into [`src/App.tsx`](/Users/tonyc/src/metarx/src/App.tsx).
- Do not fork dev/prod METAR behavior again.
- Do not bypass safe storage wrappers with raw `localStorage.setItem` calls.
- Do not commit generated `coverage/` output.
