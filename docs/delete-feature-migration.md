# Delete Feature Migration Plan

## Overview

This document describes the plan to migrate the "delete feature" functionality from the old WRI app (`wri-old`) to the new one (`wri`). The feature allows authorized users to permanently remove a spatial feature (polygon, line, or point) from a project, including all associated relational data.

---

## 1. Feature Identification

### Old App — Backend (`wri-webapi`)

**Endpoint:** `DELETE /project/{projectId}/feature/{featureId}`

**Request body (form data):**

- `featureCategory` — string: the feature type (e.g. `"terrestrial treatment area"`)
- `key` — string: user key for authentication
- `token` — string: user token for authentication

**Authorization checks (in order):**

1. `featureCategory` must be a known feature type.
2. `key` and `token` must resolve to an existing, active user.
3. The project must exist.
4. Users with role `GROUP_ANONYMOUS` or `GROUP_PUBLIC` are rejected.
5. Cancelled/Completed projects cannot be modified unless the user is a `GROUP_ADMIN`.
6. If the project has `Features = "No"`, deletion is blocked unless the user is a `GROUP_ADMIN`.
7. The user must be the project manager, a contributor, or a `GROUP_ADMIN`.

**Database operations (all in a transaction):**

For **POLY** features only, cascade-delete actions:

1. Query `AREAACTION` for action IDs where `FeatureID = featureId`.
2. Query `AREATREATMENT` for treatment IDs where `AreaActionID IN [actionIds]`.
3. Delete from `AREAHERBICIDE` where `AreaTreatmentID IN [treatmentIds]`.
4. Delete from `AREATREATMENT` where `AreaTreatmentID IN [treatmentIds]`.
5. Delete from `AREAACTION` where `AreaActionID IN [actionIds]`.

For all feature types:

6. Delete from `COUNTY` where `FeatureID = featureId AND FeatureClass = table`.
7. Delete from `LANDOWNER` where `FeatureID = featureId AND FeatureClass = table`.
8. Delete from `SGMA` where `FeatureID = featureId AND FeatureClass = table`.
9. If POLY: delete from `STREAM` where `FeatureID = featureId`.
10. Delete from the spatial table (`POLY`, `POINT`, or `LINE`) where `FeatureID = featureId AND LOWER(TypeDescription) = featureCategory`.
11. Update project stats (UPDATE `PROJECT` table with recalculated area/length totals).

**Response:** HTTP 202 Accepted.

The project stats update is performed with the following SQL (inlined stored procedure — `ProjectSpatial`):

```sql
UPDATE [dbo].[PROJECT]
SET
  [TerrestrialSqMeters]        = (SELECT SUM(AreaSqMeters) FROM POLY WHERE Project_ID = @id AND LOWER(TypeDescription) = 'terrestrial treatment area'),
  [AqRipSqMeters]              = (SELECT SUM(AreaSqMeters) FROM POLY WHERE Project_ID = @id AND LOWER(TypeDescription) = 'aquatic/riparian treatment area'),
  [StreamLnMeters]             = (SELECT SUM(Intersection) FROM STREAM WHERE ProjectID = @id),
  [AffectedAreaSqMeters]       = (SELECT SUM(AreaSqMeters) FROM POLY WHERE Project_ID = @id AND LOWER(TypeDescription) = 'affected area'),
  [EasementAcquisitionSqMeters]= (SELECT SUM(AreaSqMeters) FROM POLY WHERE Project_ID = @id AND LOWER(TypeDescription) = 'easement/acquisition'),
  [Centroid] = (... SQL Server Spatial geometry aggregate ...)
WHERE Project_ID = @id
```

> **Note:** The `Centroid` calculation uses SQL Server Spatial aggregate functions (`geometry::ConvexHullAggregate`, `geometry::EnvelopeAggregate`). Since the dev and prod environments both use SQL Server, the centroid update **will** be included in the implementation. It is executed as a raw Knex query.

---

### Old App — Frontend (`wri-web`)

**File:** `wri-web/_src/app/project/FeatureDetails.js`

- Delete button is rendered when `allowEdits` is true and a feature is selected.
- `onDeleteFeatureClick()`:
  1. Shows a native `window.confirm()` dialog: _"Do you really want to delete this feature?"_
  2. Disables the delete button to prevent double-submission.
  3. Makes a `DELETE` XHR request to the API, sending `featureCategory`, `key`, and `token` in the body.
  4. On success: broadcasts `projectIdsChanged` to reload features, and shows a success toast.
  5. On error: shows an error toast and re-enables the button.

---

## 2. Analysis of New App Implementation

### What Already Exists

**`functions/src/utils.ts`** — `canEditProject(db, projectId, key, token)`:

- Already implements the full authorization chain (project existence, user existence, role checks, contributor check).
- Ready to use as-is.

**`functions/src/utils.ts`** — `tableLookup`:

- Maps all feature category strings to `POLY`, `POINT`, or `LINE` table names.
- Can be used directly to resolve the target table.

**`src/components/ProjectFeaturesList.tsx`**:

- Already has a delete `Trash2` button that shows when `allowEdits && isSelected`.
- Currently shows `alert('Feature deleting not yet implemented')`.
- Has `kind` (poly/line/point) and feature `id` available at the button's click site.
- Has `feature.type` (the full category string like `"terrestrial treatment area"`) available.

**`@ugrc/utah-design-system`** — `AlertDialog`:

- Supports `variant="destructive"`, `actionLabel`, `cancelLabel`, `includeCancel`, and `onAction`.
- Can be wrapped in `DialogTrigger` + `Modal` from `react-aria-components` for a proper confirmation flow.

**`src/components/ProjectSpecific.tsx`**:

- Already uses `useFirebaseFunctions()` and `httpsCallable` to call Firebase functions.
- Already uses `useQuery` from `@tanstack/react-query` for the `project` and `feature` queries.
- `queryClient` can be obtained via `useQueryClient()` to invalidate the project query on success.

**`src/utils/userCredentials.ts`** — `getUserCredentials()`:

- Returns `{ key, token }` for user authentication.

### Gaps to Address

| Gap                                           | Resolution                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| No `deleteFeature` Firebase callable function | Create `functions/src/handlers/deleteFeature.ts` and register in `functions/src/index.ts`          |
| Delete button is a no-op                      | Replace `alert(...)` with `AlertDialog` confirmation + Firebase call                               |
| No post-deletion cache refresh                | Use `queryClient.invalidateQueries([ 'project', projectId ])` on success                           |
| No user feedback on error                     | Use the existing `useToast` pattern from `react-aria-components` (or `window.alert` as a fallback) |

---

## 3. Migration Plan

### Step 3a — Create Backend Handler

**File to create:** `functions/src/handlers/deleteFeature.ts`

**Input (from callable request `data`):**

```ts
{
  projectId: number,
  featureId: number,
  featureType: string,  // full category string, e.g. "terrestrial treatment area"
  key: string,
  token: string
}
```

**Logic:**

1. Validate all required inputs with `throwIfNoFormData`.
2. Parse and range-check `projectId` and `featureId`.
3. Normalize `featureType` to lowercase; confirm it exists in `tableLookup`.
4. Resolve `table` from `tableLookup` (`POLY`, `POINT`, or `LINE`).
5. Call `canEditProject(db, projectId, key, token)`. If false, throw `HttpsError('permission-denied', ...)`.
6. Execute in a Knex transaction:
   - If `table === 'POLY'`:
     - Get action IDs from `AREAACTION` where `FeatureID = featureId`.
     - If actions exist:
       - Get treatment IDs from `AREATREATMENT` where `AreaActionID IN [actionIds]`.
       - If treatments exist:
         - Delete from `AREAHERBICIDE` where `AreaTreatmentID IN [treatmentIds]`.
         - Delete from `AREATREATMENT` where `AreaTreatmentID IN [treatmentIds]`.
       - Delete from `AREAACTION` where `AreaActionID IN [actionIds]`.
   - Delete from `COUNTY`, `LANDOWNER`, `SGMA` where `FeatureID = featureId AND FeatureClass = table`.
   - If `table === 'POLY'`: delete from `STREAM` where `FeatureID = featureId`.
   - Delete from the spatial table where `FeatureID = featureId AND LOWER(TypeDescription) = featureType`.
   - Update project stats including the `Centroid` column (raw SQL using SQL Server Spatial aggregate functions).
7. Return `{ message: 'Feature deleted successfully.' }`.

**Error handling:**

- Re-throw `HttpsError` instances directly.
- Wrap unexpected errors in `HttpsError('internal', ...)`.

---

### Step 3b — Register New Callable Function

**File to update:** `functions/src/index.ts`

Add a new export:

```ts
export const deleteFeature = onCall({ ...options, secrets: [databaseInformation] }, async (request) => {
  const { deleteFeatureHandler } = await import('./handlers/deleteFeature.js');
  return deleteFeatureHandler(request);
});
```

---

### Step 3c — Wire Up Frontend

**File to update:** `src/components/ProjectFeaturesList.tsx`

1. Add prop `onDelete: (featureId: number, featureType: FeatureType) => Promise<void>`.
2. Import `AlertDialog` from `@ugrc/utah-design-system`.
3. Import `DialogTrigger, Modal` from `react-aria-components`.
4. Replace the delete button's `alert(...)` with a `DialogTrigger`-wrapped flow:

   ```tsx
   <DialogTrigger>
     <Button variant="icon" ...>
       <Trash2 className="size-4" />
     </Button>
     <Modal>
       <AlertDialog
         title="Delete Feature"
         variant="destructive"
         actionLabel="Delete"
         onAction={() => onDelete(featureId, feature.type)}
       >
         Are you sure you want to delete this feature? This action cannot be undone.
       </AlertDialog>
     </Modal>
   </DialogTrigger>
   ```

**File to update:** `src/components/ProjectSpecific.tsx`

1. Add `const deleteFeature = httpsCallable(functions, 'deleteFeature')`.
2. Add a `useMutation` (or inline async handler) that:
   - Calls `deleteFeature({ projectId, featureId, featureType, ...credentials })`.
   - On success: calls `queryClient.invalidateQueries({ queryKey: ['project', projectId] })`.
   - On error: logs and optionally surfaces the error (a follow-up improvement can add a Toast).
3. Pass `onDelete` to `<ProjectFeaturesList>`.

---

## 4. Potential Risks and Mitigations

| Risk                                               | Mitigation                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `featureType` mismatch (case sensitivity)          | Normalize to lowercase before `tableLookup` lookup and before SQL comparison          |
| Double-click / race condition on delete            | Disable delete button while the request is in-flight (via mutation `isPending` state) |
| User loses selected feature state after deletion   | On success, clear the selected feature from context and deselect in the grid          |
| `STREAM` table is only checked for `POLY` features | Confirmed by old app behavior; no change needed                                       |

---

## 5. Out of Scope

- **Toast / notification system** — Not yet implemented in the new app. Initial implementation will rely on query invalidation (the feature disappears from the list). A proper toast can be added once a notification system is established.
- **Edit feature** — The edit button has the same `alert(...)` placeholder but is a separate migration task.
