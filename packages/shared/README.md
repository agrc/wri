# @ugrc/wri-shared

Shared frontend/backend TypeScript contracts and pure domain helpers for WRI.

## What belongs here

- Request/response DTOs used on both sides of Firebase callable boundaries
- Shared domain types used by both the React app and Cloud Functions
- Pure rule helpers with no runtime dependencies on Firebase, ArcGIS, React, or the database

## What does not belong here

- Firebase client or server code
- ArcGIS-specific UI or mapping logic
- Knex/database access code
- React hooks, components, or browser-only utilities

## Import paths

Use explicit subpath imports:

- `@ugrc/wri-shared/types`
- `@ugrc/wri-shared/feature-rules`

Do not add a barrel export for this package.

## Development

- Root build: `npm run build:shared`
- Root watch: `npm run build:shared:watch`

Tests for shared helpers should live in this package so code and test ownership stay aligned.