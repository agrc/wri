# WRI Firebase Functions

This directory contains Firebase Cloud Functions for the WRI (Watershed Restoration Initiative) project.

## Prerequisites

- Node.js 22
- Firebase CLI
- Access to the Firebase project

## Available Scripts

### Database Migrations

#### `npm run migrate:create`

Creates a new Knex migration file. Migrations are used to create and modify the database schema. Pass the migration name as an argument.

```bash
npm run migrate:create -- migration_name
```

Example:

```bash
npm run migrate:create -- seed
```

### Database Seeds

#### `npm run seed`

Runs all seed files to populate the database with initial data.

```bash
npm run seed
```

#### `npm run seed:create`

Creates a new Knex seed file. Seed files should be prefixed with a padded number (e.g., `01_`, `02_`) to control execution order.

```bash
npm run seed:create -- name
```

Example:

```bash
npm run seed:create -- 01_projects
```

## Database Configuration

The functions use Knex.js for database operations. Configuration can be found in `knexfile.ts`:

- **Development**: Uses SQLite (`dev.sqlite3`)
- **Production**: Connects to Google Cloud SQL (MS SQL Server)

## Environment Variables

- `FUNCTIONS_EMULATOR`: Set to `'true'` when running in emulator mode
- `USE_PROD_DB`: Set to `'true'` to connect to production database locally
- `DATABASE_INFORMATION`: Firebase secret containing database credentials

## Local Development — Auth & `allowEdits`

In production the Java app injects `UserKey` and `Token` into a hidden `#user-data` form before the Vite bundle loads. Locally that form is empty, so credentials fall back to two Vite env vars.

Create `.env.local` in the **repo root** (already gitignored) and set one of these pairs to
simulate a specific role:

| `user_group`      | `VITE_DEV_USER_KEY` | `VITE_DEV_USER_TOKEN` | `allowEdits` behaviour                                                               |
| ----------------- | ------------------- | --------------------- | ------------------------------------------------------------------------------------ |
| `GROUP_ADMIN`     | `dev-admin-key`     | `dev-admin-token`     | `true` on all active **and** completed/cancelled projects                            |
| `GROUP_PM`        | `dev-pm-key`        | `dev-pm-token`        | `true` on project 5772 (contributor); `false` on project 1922 (completed, non-admin) |
| `GROUP_PUBLIC`    | `dev-public-key`    | `dev-public-token`    | always `false`                                                                       |
| `GROUP_ANONYMOUS` | `dev-anon-key`      | `dev-anon-token`      | always `false`                                                                       |

Example `.env.local`:

```
VITE_DEV_USER_KEY=dev-admin-key
VITE_DEV_USER_TOKEN=dev-admin-token
```

Run `npm run seed` inside `functions/` after running migrations to populate the test users.

## Project Structure

```bash
functions/
├── src/           # TypeScript source files
├── lib/           # Compiled JavaScript output
├── migrations/    # Knex migration files
├── seeds/         # Knex seed files
├── knexfile.ts    # Knex configuration
└── package.json   # Dependencies and scripts
```
