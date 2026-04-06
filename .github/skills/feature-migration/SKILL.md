---
name: feature-migration
description: Use this skill for the migration of features from the old WRI app (wri-old) to the new WRI app (wri).
---

# Feature Migration Skill

This skill is designed to assist in the migration of features from the old WRI app to the new one. It provides a structured approach to ensure that all necessary steps are taken for a successful migration.

## Definitions

This skill is intended to be used in a workspace with two folders:

### `wri-old`

This folder contains the old WRI app codebase. It includes the following components:

- `src/`: The Java app within which the map application is embedded.
- `wri-web/`: This is the map application. It is a JavaScript application built on old versions of Dojo and Esri's ArcGIS API for JavaScript.
- `wri-webapi/`: This is the API that the map application uses to communicate with the backend. It is a .NET application.

### `wri`

This folder contains the new WRI map application codebase. It includes the following components:

- `src/`: The new map application. It is a TypeScript application built on React and Esri's ArcGIS API for JavaScript version 4.x.
- `functions/`: This is the new API that the map application uses to communicate with the backend. It is a Node.js application hosted on Firebase Functions. This is the replacement for the old `wri-webapi` .NET application.

## Context

This new map application is being built from the ground up, so there is no shared code between the old and new applications. The migration process will involve planning how features from the old application will be re-implemented in the new one, while also taking advantage of the new technologies and architecture.

The Java app that embeds the map application is not being migrated at this time, so the new map application will need to be designed to be embedded in the same way as the old one. The new `wri` project has a mock wrapper in `index.html` that simulates the embedding environment for development purposes.

The new application has not yet been deployed to production so there is no concern about breaking changes while making updates to it.

## Database

The new application will use the same SQL Server database. The schema will remain unchanged. Use `wri/docs/database-schema.md` as a reference for the database schema. Suggest updates to it if you find any new information from the old app.

## Steps for migration

1. **Identify Features** Identify the features in the old application that need to be migrated. Thoroughly review the old codebase to understand the functionality and dependencies of each feature. Point out any inconsistencies or areas that may require special attention during migration. You must cover all code paths, including edge cases and error handling, to ensure a comprehensive understanding of the features being migrated. Document your findings in a clear and organized manner to facilitate the migration process.
2. **Analyze Implementation** For each identified feature, analyze how it can be implemented in the new application. Consider the differences in technology stacks and architecture between the old and new applications. Determine if there are any opportunities to improve the feature during migration, such as enhancing performance or user experience. Ask clarifying questions if needed.
3. **Create Migration Plan** Create a detailed migration plan for each feature, outlining the steps required to implement it in the new application. This should include any necessary changes to the backend API, as well as updates to the frontend code. Ensure that the plan accounts for any potential challenges or risks that may arise during migration, and propose strategies to mitigate them. Save the plan to a markdown file within the `wri/docs/` directory.
4. **Review and Refine** Present the plan to me for refinement and feedback. The goal is to create a comprehensive and actionable migration plan before making any code changes.
5. **Implement Migration** Once you have permission from me to proceed, implement the migration for each feature. Follow the steps outlined in the plan, and ensure that all code changes are thoroughly tested to maintain the integrity of the application. Document any deviations from the original plan and the reasons for those changes.
