# MetarX

MetarX is a single-page aviation weather app for quickly looking up an airport METAR and turning the raw report into a readable weather briefing. It pairs a React/Vite frontend with a lightweight NOAA proxy so the app can stay deployable as a static site while avoiding browser CORS issues.

## Stack

- React 19 + Vite + TypeScript
- Framer Motion for animated transitions and loading states
- Lucide icons
- OpenRouter provider for the Vercel AI SDK
- React Markdown for streamed pilot-analysis rendering
- Vitest + Testing Library for unit and UI smoke tests
- Vercel-style serverless functions for the NOAA proxy and pilot-analysis stream

## Features

- ICAO airport code lookup with normalization and validation
- Live METAR retrieval from the official NOAA Aviation Weather source
- Decoded weather breakdown for flight category, wind, visibility, clouds, temperature, dew point, pressure, weather, and remarks
- Optional pilot-focused LLM analysis with streamed markdown output and an instructor-style perspective
- Recent searches and favorites stored in local storage
- System-aware light/dark theme with manual override
- Responsive layout for phone, laptop, and desktop screens

## Development

```bash
npm install
npm run dev
```

Create a local env file before using the pilot-analysis feature:

```bash
cp .env.example .env.local
```

Required variable:

- `OPENROUTER_API_KEY`

The pilot-analysis route uses the fixed OpenRouter model `google/gemini-3-flash-preview`.

For local development, if `MetarX/.env.local` is absent, the server also falls back to `/home/tonyc/source/tonybot/.env.local` for the OpenRouter API key.

The Vite dev server exposes the frontend plus local `/api/metar` and `/api/pilot-analysis` middleware so local development matches the deployed app contract.

## Scripts

- `npm run dev` starts the app locally
- `npm run build` creates the production bundle
- `npm run test` runs the Vitest suite
- `npm run lint` runs ESLint
- `npm run preview` serves the production build locally

## API contract

The frontend calls:

```text
GET /api/metar?code=KJFK
```

The proxy returns a mapped response with:

- `rawMetar`
- `station`
- `observedAt`
- `flightCategory`
- `decoded`
- `source`

The pilot-analysis feature calls:

```text
POST /api/pilot-analysis
```

This route streams markdown text chunks over `text/event-stream` and is intended to be consumed incrementally by the SPA.

## Deployment

This repository is set up for static hosting plus a serverless function.

- Frontend: Vite build output in `dist/`
- API: [`api/metar.ts`](/home/tonyc/source/metarx/api/metar.ts)
- Analysis API: [`api/pilot-analysis.ts`](/home/tonyc/source/metarx/api/pilot-analysis.ts)
- Recommended target: Vercel

The NOAA Aviation Weather endpoint at `https://aviationweather.gov/api/data/metar` is used as the source of truth. The proxy exists because NOAA currently does not advertise browser-safe CORS headers for direct client requests.

## Testing focus

- ICAO input validation and normalization
- NOAA payload mapping into the frontend contract
- Pilot-analysis prompt construction and streamed UI rendering
- Theme persistence and resolution
- Recent/favorites local storage behavior
- App smoke coverage for idle, loading, success, error, theme, and pilot-analysis flows
