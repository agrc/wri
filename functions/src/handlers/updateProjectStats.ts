import * as logger from 'firebase-functions/logger';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../database.js';
import { canEditProject, throwIfNoFormData, updateProjectStats } from '../utils.js';

/**
 * Handler for recalculating project-level spatial statistics.
 * Validates input, checks authorization, then runs updateProjectStats inside a transaction.
 */
export const updateProjectStatsHandler = async ({ data }: CallableRequest) => {
  throwIfNoFormData(data);

  try {
    const projectId = parseInt(data?.projectId?.toString() ?? '-1', 10);
    const key = data?.key?.toString() ?? null;
    const token = data?.token?.toString() ?? null;

    if (isNaN(projectId) || projectId <= 0 || projectId > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid project ID');
    }

    logger.info('Updating project stats', { projectId });

    const db = await getDb();

    const canEdit = await canEditProject(db, projectId, key, token);
    if (!canEdit) {
      throw new HttpsError('permission-denied', 'You do not have permission to edit this project');
    }

    await db.transaction((trx) => updateProjectStats(trx, projectId));

    return { message: 'Project statistics updated successfully.' };
  } catch (error) {
    logger.error('Error updating project stats:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new HttpsError(
      'internal',
      `Failed to update project statistics (projectId=${data?.projectId}): ${errorMessage}`,
    );
  }
};
