# Copilot instructions for WRI

> Keep this file terse and focused. Update it as the project evolves or when the user gives you new information.

## Big picture

- Frontend is a Vite + React 19 app in `src/`, served by Firebase Hosting, with multiple HTML entry points: `map.html`, `index.html`, and `search.html` (see `vite.config.ts`).
- Backend is Firebase Cloud Functions in `functions/src/` using callable endpoints (`project`, `feature`) and Knex for data access (see `functions/src/index.ts`, `functions/src/database.ts`).
- ArcGIS JS SDK is central: map UI lives in `src/components/` and `src/App.tsx`, and assets are served from `/js/ugrc/assets` in dev and `/wri/js/ugrc/assets` in prod (see `src/App.tsx`).

## Local dev workflows

- Root dev: `npm run start` runs functions build-watch, Firebase emulators, then Vite after `healthCheck` is up (see `package.json` and `firebase.json`).
- Frontend-only: `npm run dev:vite` or `npm run dev:extractions-test` (see `package.json`).
- Functions: `cd functions && npm run build:watch` and `npm run serve` for emulators; deploy with `npm run deploy`.
- DB workflow: local functions connect to the shared dev SQL Server through a developer-managed Cloud SQL proxy; the repo does not manage schema migrations or seed data (see `functions/README.md`).
- Run tests with `npm run test` (see `vite.config.ts` for test config).
- Run linting with `npm run lint` (see `package.json`).
- Run type checks with `npm run check` (see `package.json`).
- Run tests, linting, and type checks after every code change to verify correctness and catch issues early.

## Environment and auth conventions

- Root `.env.local` must define `VITE_FIREBASE_CONFIG` JSON (frontend bootstrap in `src/main.tsx`).
- Local auth is optional in development; set `DEV_USER_EMAIL` in `.env.local` to let `npm start` auto-load credentials from the dev database for the session (see `functions/README.md`).
- `DATABASE_INFORMATION` is a Firebase secret with `user`, `password`, and `instance` for prod DB access (see `README.md`, `functions/src/database.ts`).

## Project-specific patterns

- Firebase callable functions dynamically import handlers to reduce cold starts (see `functions/src/index.ts`).
- Knex connection is cached across invocations and cleaned on process exit (see `functions/src/database.ts`).
- Map UI uses context providers (`MapProvider`, `ProjectProvider`, `FilterProvider`) and ArcGIS components from `@arcgis/map-components` (see `src/main.tsx`, `src/App.tsx`, `src/AppSearch.tsx`).
- Production base path is `/wri/` (see `vite.config.ts`), so keep asset and routing paths compatible.
- ArcGIS assets are copied into `public/js/ugrc/assets` via `npm run copy:arcgis` when needed.

## Integration points

- Firebase Hosting serves the Vite build and proxies callable functions; local `healthCheck` only exists in emulator mode (see `firebase.json`, `functions/src/index.ts`).
- ArcGIS basemap tiles use `VITE_DISCOVER` token for `discover.agrc.utah.gov` (see `src/AppSearch.tsx`).

## Where to look first

- Frontend entry: `src/main.tsx` and `src/App.tsx`
- Search map flow: `src/AppSearch.tsx` and `src/hooks/useShapefileUpload.ts`
- Functions handlers: `functions/src/handlers/` and DB access in `functions/src/database.ts`

## Commit Message Format

All commits must follow the Conventional Commits format using the Angular preset.
