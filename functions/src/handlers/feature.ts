import * as logger from 'firebase-functions/logger';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from '../database.js';
import { processRollup, tableLookup, throwIfNoFormData } from '../utils.js';

/**
 * Handler for feature data requests
 * Fetches rollup data for a specific feature including county, SGMA, owner, and stream information
 */
export const featureHandler = async ({ data }: CallableRequest) => {
  throwIfNoFormData(data);

  try {
    const featureId = parseInt(data?.featureId?.toString() ?? '-1', 10);
    const type = data?.type?.toString().toLowerCase() ?? '';

    if (isNaN(featureId) || featureId <= 0 || featureId > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid feature ID');
    }

    if (!(type in tableLookup)) {
      throw new HttpsError('invalid-argument', 'Invalid feature type');
    }

    const table = tableLookup[type] as string;

    logger.info('Fetching feature data', { featureId, table });

    const db = await getDb();
    const rollupQuery = db
      .select({
        origin: db.raw(`'county'`),
        table: db.raw('?', [table]),
        name: 'c.County',
        extra: db.raw('null'),
        space: 'c.Intersection',
      })
      .from({ c: 'COUNTY' })
      .where('c.FeatureID', featureId)
      .andWhere('c.FeatureClass', table)
      .unionAll([
        db
          .select({
            origin: db.raw(`'sgma'`),
            table: db.raw('?', [table]),
            name: 's.SGMA',
            extra: db.raw('null'),
            space: 's.Intersection',
          })
          .from({ s: 'SGMA' })
          .where('s.FeatureID', featureId)
          .andWhere('s.FeatureClass', table),
        db
          .select({
            origin: db.raw(`'owner'`),
            table: db.raw('?', [table]),
            name: 'l.Owner',
            extra: 'l.Admin',
            space: 'l.Intersection',
          })
          .from({ l: 'LANDOWNER' })
          .where('l.FeatureID', featureId)
          .andWhere('l.FeatureClass', table),
        db
          .select({
            origin: db.raw(`'nhd'`),
            table: db.raw('?', [table]),
            name: 'n.StreamDescription',
            extra: db.raw('null'),
            space: 'n.Intersection',
          })
          .from({ n: 'STREAM' })
          .where('n.FeatureID', featureId)
          .andWhereRaw('?=?', [table, 'POLY']),
      ]);

    logger.debug('Feature data query', { query: rollupQuery.toString() });

    const rollup = await rollupQuery;

    return processRollup(rollup, true);
  } catch (error) {
    logger.error('Error fetching feature data:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', 'Failed to fetch feature data');
  }
};
