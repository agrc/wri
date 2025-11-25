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

Creates a new Knex seed file. Pass the seed name as an argument prefix with a padded number to run them in order.

```bash
npm run seed:create -- seed_name
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
