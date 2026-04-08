import type { DeleteFeatureResponse, FeatureTable } from '@ugrc/wri-shared/types';
import * as logger from 'firebase-functions/logger';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Knex } from 'knex';
import { getDb } from '../database.js';
import { canEditProject, tableLookup, throwIfNoFormData, updateProjectStats } from '../utils.js';

/**
 * Deletes all related rows for a polygon feature in a transaction:
 * AREAHERBICIDE → AREATREATMENT → AREAACTION
 */
const deletePolyActions = async (trx: Knex.Transaction, featureId: number) => {
  const actions = await trx.select('AreaActionId').from('AREAACTION').where('FeatureID', featureId);
  const actionIds = actions.map((a: { AreaActionId: number }) => a.AreaActionId);

  if (actionIds.length === 0) {
    return;
  }

  const treatments = await trx.select('AreaTreatmentID').from('AREATREATMENT').whereIn('AreaActionID', actionIds);
  const treatmentIds = treatments.map((t: { AreaTreatmentID: number }) => t.AreaTreatmentID);

  if (treatmentIds.length > 0) {
    await trx('AREAHERBICIDE').whereIn('AreaTreatmentID', treatmentIds).delete();
    await trx('AREATREATMENT').whereIn('AreaTreatmentID', treatmentIds).delete();
  }

  await trx('AREAACTION').whereIn('AreaActionId', actionIds).delete();
};

/**
 * Deletes all GIS rollup rows (COUNTY, LANDOWNER, SGMA, STREAM) for a feature.
 */
const deleteExtractedGis = async (trx: Knex.Transaction, featureId: number, table: FeatureTable) => {
  for (const rollupTable of ['COUNTY', 'LANDOWNER', 'SGMA']) {
    await trx(rollupTable).where('FeatureID', featureId).andWhere('FeatureClass', table).delete();
  }

  if (table === 'POLY') {
    await trx('STREAM').where('FeatureID', featureId).delete();
  }
};

/**
 * Core transaction body — exported for unit testing.
 * Deletes the feature and all related data, then refreshes project stats.
 */
export const deleteFeatureTransaction = async (
  trx: Knex.Transaction,
  projectId: number,
  featureId: number,
  featureType: string,
  table: FeatureTable,
) => {
  // Note: deletePolyActions and deleteExtractedGis run before the ownership-checked delete below.
  // This is safe because everything runs inside a transaction — if the ownership check fails and
  // throws, the entire transaction rolls back, so none of the cascaded deletions are committed.
  if (table === 'POLY') {
    await deletePolyActions(trx, featureId);
  }

  await deleteExtractedGis(trx, featureId, table);

  // delete the feature itself — also filter by Project_ID to prevent cross-project deletes
  const deleted = await trx(table)
    .where('FeatureID', featureId)
    .where('Project_ID', projectId)
    .whereRaw('LOWER(TypeDescription) = ?', [featureType])
    .delete();

  if (!deleted) {
    throw new HttpsError('not-found', `Feature ${featureId} not found in project ${projectId}`);
  }

  // Recalculate project-level spatial stats including centroid.
  // must run after deletions.
  await updateProjectStats(trx, projectId);
};

/**
 * Handler for delete feature requests.
 * Validates input, checks authorization, then deletes the feature and all related data.
 */
export const deleteFeatureHandler = async ({ data }: CallableRequest): Promise<DeleteFeatureResponse> => {
  throwIfNoFormData(data);

  try {
    const projectId = parseInt(data?.projectId?.toString() ?? '-1', 10);
    const featureId = parseInt(data?.featureId?.toString() ?? '-1', 10);
    const featureType = data?.featureType?.toString().toLowerCase() ?? '';
    const key = data?.key?.toString() ?? null;
    const token = data?.token?.toString() ?? null;

    if (isNaN(projectId) || projectId <= 0 || projectId > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid project ID');
    }

    if (isNaN(featureId) || featureId <= 0 || featureId > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid feature ID');
    }

    const table = tableLookup[featureType];

    if (!table) {
      throw new HttpsError('invalid-argument', 'Invalid feature type');
    }

    logger.info('Deleting feature', { projectId, featureId, featureType, table });

    const db = await getDb();

    const canEdit = await canEditProject(db, projectId, key, token);
    if (!canEdit) {
      throw new HttpsError('permission-denied', 'You do not have permission to edit this project');
    }

    await db.transaction((trx) => deleteFeatureTransaction(trx, projectId, featureId, featureType, table));

    return { message: 'Feature deleted successfully.' };
  } catch (error) {
    logger.error('Error deleting feature:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new HttpsError(
      'internal',
      `Failed to delete feature (projectId=${data?.projectId}, featureId=${data?.featureId}, featureType=${data?.featureType}): ${errorMessage}`,
    );
  }
};
