# Copilot instructions for WRI

> Keep this file terse and focused. Update it as the project evolves or when the user gives you new information.

## Big picture

- Frontend is a Vite + React 19 app in `src/`, served by Firebase Hosting, with multiple HTML entry points: `map.html`, `index.html`, and `search.html` (see `vite.config.ts`).
- Backend is Firebase Cloud Functions in `functions/src/` using callable endpoints (`project`, `feature`) and Knex for data access (see `functions/src/index.ts`, `functions/src/database.ts`).
- Shared frontend/backend DTOs and pure domain helpers live in `functions/shared/src/`; consume them via `@ugrc/wri-shared/types` and `@ugrc/wri-shared/feature-rules` rather than redefining shapes in app code.
- ArcGIS JS SDK is central: map UI lives in `src/components/` and `src/App.tsx`, and assets are served from `/js/ugrc/assets` in dev and `/wri/js/ugrc/assets` in prod (see `src/App.tsx`).

## Local dev workflows

- Root dev: `pnpm start` runs shared package watch, functions build-watch, Firebase emulators, then Vite after `healthCheck` is up (see `package.json` and `firebase.json`).
- Frontend-only: `pnpm dev:vite` or `pnpm dev:extractions-test` (see `package.json`).
- Functions: `pnpm --filter @ugrc/wri-functions build:watch` and `pnpm --filter @ugrc/wri-functions serve` for emulators; deploy with `pnpm --filter @ugrc/wri-functions deploy`.
- Shared package: `pnpm build:shared` builds `functions/shared`, and `pnpm build:shared:watch` keeps shared outputs fresh during local development.
- DB workflow: local functions connect to the shared dev SQL Server through a developer-managed Cloud SQL proxy; forward-only schema and reference-data changes are managed with Knex migrations (see `functions/README.md`).
- Run tests with `pnpm test` (see `vite.config.ts` for test config).
- Run linting with `pnpm lint` (see `package.json`).
- Run type checks with `pnpm check` (see `package.json`).
- Run tests, linting, and type checks after every code change to verify correctness and catch issues early.

## Environment and auth conventions

- Root `.env.local` must define `VITE_FIREBASE_CONFIG` JSON (frontend bootstrap in `src/main.tsx`).
- Local auth is optional in development; set `DEV_USER_EMAIL` in `.env.local` to let `pnpm start` auto-load credentials from the dev database for the session (see `functions/README.md`).
- `DATABASE_INFORMATION` is a Firebase secret with `user`, `password`, and `instance` for prod DB access (see `README.md`, `functions/src/database.ts`).

## Project-specific patterns

- Firebase callable functions dynamically import handlers to reduce cold starts (see `functions/src/index.ts`).
- Frontend callable clients should use `src/hooks/useTypedCallable.ts` so request/response types stay aligned with shared DTOs instead of relying on ad hoc `result.data` casts.
- Knex connection is cached across invocations and cleaned on process exit (see `functions/src/database.ts`).
- Map UI uses context providers (`MapProvider`, `ProjectProvider`, `FilterProvider`) and ArcGIS components from `@arcgis/map-components` (see `src/main.tsx`, `src/App.tsx`, `src/AppSearch.tsx`).
- Production base path is `/wri/` (see `vite.config.ts`), so keep asset and routing paths compatible.
- ArcGIS assets are copied into `public/js/ugrc/assets` via `pnpm copy:arcgis` when needed.

## Integration points

- Firebase Hosting serves the Vite build and proxies callable functions; local `healthCheck` only exists in emulator mode (see `firebase.json`, `functions/src/index.ts`).
- ArcGIS basemap tiles use `VITE_DISCOVER` token for `discover.agrc.utah.gov` (see `src/AppSearch.tsx`).

## Where to look first

- Frontend entry: `src/main.tsx` and `src/App.tsx`
- Search map flow: `src/AppSearch.tsx` and `src/hooks/useShapefileUpload.ts`
- Functions handlers: `functions/src/handlers/` and DB access in `functions/src/database.ts`

## Commit Message Format

All commits must follow the Conventional Commits format using the Angular preset.
