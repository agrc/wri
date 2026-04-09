# WRI Firebase Functions

This directory contains Firebase Cloud Functions for the WRI (Watershed Restoration Initiative) project.

## Prerequisites

- Node.js 22
- Firebase CLI
- Access to the Firebase project

## Available Scripts

### `npm run build`

Builds the Firebase Functions TypeScript source into `lib/`.

### `npm run build:watch`

Watches the Firebase Functions TypeScript source and rebuilds on change.

### `npm run serve`

Builds the functions and starts the local Firebase Functions emulator.

## Database Configuration

The functions use Knex.js for runtime database operations.

- **Local development**: Connects to the dev SQL Server through a developer-managed Cloud SQL proxy on `localhost`
- **Production**: Connects to Google Cloud SQL (MS SQL Server) through the Cloud SQL connector

## Environment Variables

- `FUNCTIONS_EMULATOR`: Set to `'true'` when running in emulator mode
- `DATABASE_INFORMATION`: Firebase secret containing database credentials

## Local Development — Auth & `allowEdits`

In production the Java app injects `UserKey` and `Token` into a hidden `#user-data` form before the Vite bundle loads. Locally that form is empty, so `npm start` can optionally inject credentials from the dev database when `DEV_USER_EMAIL` is configured.

Prerequisites:

- Start your Cloud SQL proxy first
- Set `DATABASE_INFORMATION` in `functions/.secret.local` with local proxy connection information
- Ensure the shared dev database already contains the schema and the user referenced by `DEV_USER_EMAIL`

Set this optional value in root `.env.local` if you want local edit credentials:

```text
DEV_USER_EMAIL=your.email@example.com
```

When `DEV_USER_EMAIL` is set, `npm start` reads `UserKey` and `Token` for that user from the dev database and injects them into the local app session. If `DEV_USER_EMAIL` is omitted, the app still starts but runs without local credentials, which means edit operations remain unavailable.

### Local Development — Database Ownership

This repo assumes the existing shared dev database already exists and is already provisioned. It does not attempt to recreate legacy schema history. New database changes can be applied forward from the current baseline using the migration workflow below.

## Database Migrations

The functions package now includes a forward-only Knex migration framework for new schema and reference-data changes.

- Baseline policy: existing schema is assumed; migrations start from the current shared database state.
- Current migration storage table: `knex_migrations`.
- Connection source: `functions/.secret.local` by default, or `DATABASE_INFORMATION` if you export it explicitly.

Available commands:

```bash
cd functions
npm run db:migrate:status
npm run db:migrate:latest
npm run db:migrate:rollback
npm run db:migrate:make -- migration_name
```

Notes:

- Local migration runs expect the Cloud SQL proxy to be running and reachable on the port declared in `DATABASE_INFORMATION`.
- Migration `20260409133000_add_affected_area_actions.ts` is the first forward migration and adds the Affected Area action lookup rows.
- Treat lookup-data changes that are required by application behavior as migrations, not ad hoc seed scripts.

## Project Structure

```bash
functions/
├── migrations/    # Forward-only Knex migrations
├── knexfile.ts    # Knex migration generation config
├── src/           # TypeScript source files
├── scripts/       # Local dev and migration helpers
├── lib/           # Compiled JavaScript output
└── package.json   # Dependencies and scripts
```
