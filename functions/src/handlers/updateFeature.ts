import type Multipoint from '@arcgis/core/geometry/Multipoint.js';
import type Polygon from '@arcgis/core/geometry/Polygon.js';
import type Polyline from '@arcgis/core/geometry/Polyline.js';
import { isStreamEligibleFeatureType } from '@ugrc/wri-shared/feature-rules';
import type {
  CreateFeatureResponse,
  FeatureTable,
  PointLineAction,
  PolyAction,
  RetreatmentValue,
  UpdateFeatureRequest,
  UpdateFeatureResponse,
} from '@ugrc/wri-shared/types';
import * as logger from 'firebase-functions/logger';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Knex } from 'knex';
import { getDb } from '../database.js';
import {
  canEditProject,
  assertNoPolygonOverlap,
  convertMetersToAcres,
  convertMetersToMiles,
  parseRetreatmentInput,
  tableLookup,
  throwIfNoFormData,
  updateProjectStats,
  validateActions,
  validateRetreatment,
} from '../utils.js';
import { geometriesArrayToWkt, geometryToWkt, insertExtractedGis, insertPolyActions } from './createFeature.js';
import { deleteExtractedGis, deletePolyActions } from './deleteFeature.js';
import {
  calculateAreasAndLengths,
  extractIntersections,
  FEATURE_SERVICE_CONFIG,
  FeatureServiceQueryError,
  projectGeometries,
  SPATIAL_REFERENCES,
  unionGeometries,
  type ExtractionCriteria,
  type IntersectionResponse,
} from './extractions.js';

async function importArcGIS() {
  const { fromJSON } = await import('@arcgis/core/geometry/support/jsonUtils.js');
  return { fromJSON };
}

const GEOMETRY_TYPE_BY_TABLE: Record<FeatureTable, string> = {
  POLY: 'esriGeometryPolygon',
  LINE: 'esriGeometryPolyline',
  POINT: 'esriGeometryMultipoint',
};

export const updateFeatureTransaction = async (
  trx: Knex.Transaction,
  projectId: number,
  featureId: number,
  featureType: string,
  table: FeatureTable,
  wkt: string,
  retreatment: RetreatmentValue,
  actions: PolyAction[] | PointLineAction[] | null,
  areaSqMeters: number | null,
  lengthLnMeters: number | null,
  intersections: IntersectionResponse,
): Promise<{ featureId: number; statusDescription: string | null }> => {
  const existingFeature = await trx(table)
    .select({ featureId: 'FeatureID', typeDescription: 'TypeDescription' })
    .where('FeatureID', featureId)
    .andWhere('Project_ID', projectId)
    .first();

  if (!existingFeature) {
    throw new HttpsError('not-found', `Feature ${featureId} not found in project ${projectId}`);
  }

  if ((existingFeature.typeDescription as string | null | undefined)?.toLowerCase() !== featureType.toLowerCase()) {
    throw new HttpsError('invalid-argument', 'Feature type cannot be changed');
  }

  if (table === 'POLY') {
    await assertNoPolygonOverlap(trx, projectId, featureType, wkt, featureId);
  }

  const project = await trx('PROJECT')
    .select({ status: 'Status', statusCode: 'StatusID' })
    .where('Project_ID', projectId)
    .first();
  const statusDescription: string | null = project?.status ?? null;
  const statusCode: number | null = project?.statusCode ?? null;

  const typeRow = await trx('LU_FEATURETYPE')
    .whereRaw('LOWER(FeatureTypeDescription) = LOWER(?)', [featureType])
    .select({ typeCode: 'FeatureTypeID' })
    .first();
  const typeCode: number | null = typeRow?.typeCode ?? null;

  if (table === 'POLY') {
    await deletePolyActions(trx, featureId);
  }

  await deleteExtractedGis(trx, featureId, table);

  if (table === 'POLY') {
    const updated = await trx('POLY')
      .where('FeatureID', featureId)
      .andWhere('Project_ID', projectId)
      .update({
        TypeDescription: featureType,
        Retreatment: retreatment,
        Shape: trx.raw('geometry::STGeomFromText(?, 3857).MakeValid()', [wkt]),
        TypeCode: typeCode,
        StatusDescription: statusDescription,
        StatusCode: statusCode,
        AreaSqMeters: areaSqMeters,
      });

    if (!updated) {
      throw new HttpsError('not-found', `Feature ${featureId} not found in project ${projectId}`);
    }

    if (actions) {
      await insertPolyActions(trx, featureId, actions as PolyAction[]);
    }
  } else if (table === 'LINE') {
    const action = (actions as PointLineAction[])[0]!;

    const subTypeRow = await trx('LU_FEATURESUBTYPE')
      .whereRaw('LOWER(FeatureSubTypeDescription) = LOWER(?)', [action.type])
      .select({ id: 'FeatureSubTypeID' })
      .first();

    const actionRow = await trx('LU_ACTION')
      .whereRaw('LOWER(ActionDescription) = LOWER(?)', [action.action])
      .select({ id: 'ActionID' })
      .first();

    const updated = await trx('LINE')
      .where('FeatureID', featureId)
      .andWhere('Project_ID', projectId)
      .update({
        TypeDescription: featureType,
        FeatureSubTypeDescription: action.type,
        ActionDescription: action.action,
        Description: action.description?.trim() || null,
        Shape: trx.raw('geometry::STGeomFromText(?, 3857).MakeValid()', [wkt]),
        StatusDescription: statusDescription,
        StatusCode: statusCode,
        TypeCode: typeCode,
        FeatureSubTypeID: subTypeRow?.id ?? null,
        ActionID: actionRow?.id ?? null,
        LengthLnMeters: lengthLnMeters,
      });

    if (!updated) {
      throw new HttpsError('not-found', `Feature ${featureId} not found in project ${projectId}`);
    }
  } else {
    const pointActions = (actions ?? []) as PointLineAction[];
    const action = pointActions[0] ?? null;

    const subTypeRow =
      action?.type != null
        ? await trx('LU_FEATURESUBTYPE')
            .whereRaw('LOWER(FeatureSubTypeDescription) = LOWER(?)', [action.type])
            .select({ id: 'FeatureSubTypeID' })
            .first()
        : null;

    const actionRow =
      action?.action != null
        ? await trx('LU_ACTION')
            .whereRaw('LOWER(ActionDescription) = LOWER(?)', [action.action])
            .select({ id: 'ActionID' })
            .first()
        : null;

    const updated = await trx('POINT')
      .where('FeatureID', featureId)
      .andWhere('Project_ID', projectId)
      .update({
        TypeDescription: featureType,
        FeatureSubTypeDescription: action?.type ?? null,
        ActionDescription: action?.action ?? null,
        Description: action?.description?.trim() || null,
        Shape: trx.raw('geometry::STGeomFromText(?, 3857).MakeValid()', [wkt]),
        StatusDescription: statusDescription,
        StatusCode: statusCode,
        TypeCode: typeCode,
        FeatureSubTypeID: subTypeRow?.id ?? null,
        ActionID: actionRow?.id ?? null,
      });

    if (!updated) {
      throw new HttpsError('not-found', `Feature ${featureId} not found in project ${projectId}`);
    }
  }

  await insertExtractedGis(trx, featureId, table, projectId, intersections);
  await updateProjectStats(trx, projectId);

  return { featureId, statusDescription };
};

export const updateFeatureHandler = async ({ data }: CallableRequest): Promise<UpdateFeatureResponse> => {
  throwIfNoFormData(data);

  try {
    const request = data as UpdateFeatureRequest;
    const projectId = parseInt(request.projectId?.toString() ?? '-1', 10);
    const featureId = parseInt(request.featureId?.toString() ?? '-1', 10);
    const featureType = request.featureType?.toString() ?? '';
    const key = request.key?.toString() ?? null;
    const token = request.token?.toString() ?? null;
    const retreatment = parseRetreatmentInput(request.retreatment);
    const actions = (request.actions ?? null) as PolyAction[] | PointLineAction[] | null;
    const geometryData = request.geometry as object | object[] | null;

    if (isNaN(projectId) || projectId <= 0 || projectId > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid project ID');
    }

    if (isNaN(featureId) || featureId <= 0 || featureId > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid feature ID');
    }

    const table = tableLookup[featureType.toLowerCase()];
    if (!table) {
      throw new HttpsError('invalid-argument', 'Invalid feature type');
    }

    if (!geometryData || typeof geometryData !== 'object') {
      throw new HttpsError('invalid-argument', 'Geometry is required');
    }

    if (Array.isArray(geometryData) && geometryData.length === 0) {
      throw new HttpsError('invalid-argument', 'Geometry array must not be empty');
    }

    validateActions(table, featureType, actions);
    validateRetreatment(featureType, retreatment);

    const db = await getDb();

    const canEdit = await canEditProject(db, projectId, key, token);
    if (!canEdit) {
      throw new HttpsError('permission-denied', 'You do not have permission to edit this project');
    }

    logger.info('Updating feature', { projectId, featureId, featureType, table });

    const { fromJSON } = await importArcGIS();

    const geometryType = GEOMETRY_TYPE_BY_TABLE[table];
    const shouldExtractStream = table === 'POLY' && isStreamEligibleFeatureType(featureType);
    const extractCriteria: ExtractionCriteria = {
      county: { attributes: [...FEATURE_SERVICE_CONFIG.county.attributes] },
      landowner: { attributes: [...FEATURE_SERVICE_CONFIG.landowner.attributes] },
      sgma: { attributes: [...FEATURE_SERVICE_CONFIG.sgma.attributes] },
      ...(shouldExtractStream ? { stream: { attributes: [...FEATURE_SERVICE_CONFIG.stream.attributes] } } : {}),
    };

    let wkt: string;
    let areaSqMeters: number | null;
    let lengthLnMeters: number | null;
    let intersectionGeometry: Polygon | Polyline | Multipoint;

    if (Array.isArray(geometryData)) {
      const geoms = geometryData.map((datum) => fromJSON(datum as object)) as (Polygon | Polyline | Multipoint)[];
      const projectedGeometries = await projectGeometries(geoms, SPATIAL_REFERENCES.UTM_ZONE_12N);
      const validProjected = projectedGeometries.filter((geometry) => geometry?.spatialReference);

      if (validProjected.length === 0) {
        throw new HttpsError(
          'invalid-argument',
          'Failed to project the submitted geometries to the required spatial reference.',
        );
      }

      const unioned = await unionGeometries(validProjected);

      if (!unioned) {
        throw new HttpsError('invalid-argument', 'Failed to union the submitted geometries.');
      }

      const areasLengths = await (table !== 'POINT'
        ? calculateAreasAndLengths([unioned as object], geometryType)
        : Promise.resolve({ areas: null, lengths: null }));

      areaSqMeters = areasLengths.areas?.[0] ?? null;
      lengthLnMeters = areasLengths.lengths?.[0] ?? null;
      intersectionGeometry = unioned as Polygon | Polyline | Multipoint;
      wkt = geometriesArrayToWkt(geoms);
    } else {
      const geometry = fromJSON(geometryData);
      const [projectedGeometry] = await projectGeometries([geometry], SPATIAL_REFERENCES.UTM_ZONE_12N);

      if (!projectedGeometry || !projectedGeometry.spatialReference) {
        throw new HttpsError(
          'invalid-argument',
          'Failed to project the submitted geometry to the required spatial reference.',
        );
      }

      const areasLengths = await (table !== 'POINT'
        ? calculateAreasAndLengths([projectedGeometry as object], geometryType)
        : Promise.resolve({ areas: null, lengths: null }));

      areaSqMeters = areasLengths.areas?.[0] ?? null;
      lengthLnMeters = areasLengths.lengths?.[0] ?? null;
      intersectionGeometry = projectedGeometry as Polygon | Polyline | Multipoint;
      wkt = geometryToWkt(geometry as Polygon | Polyline | Multipoint);
    }

    const intersections = await extractIntersections(intersectionGeometry, extractCriteria);

    const result = await db.transaction((trx) =>
      updateFeatureTransaction(
        trx,
        projectId,
        featureId,
        featureType,
        table,
        wkt,
        retreatment,
        actions,
        areaSqMeters,
        lengthLnMeters,
        intersections,
      ),
    );

    let message: CreateFeatureResponse['message'];
    if (table === 'POLY' && areaSqMeters != null) {
      message = `Successfully updated ${featureType} to cover ${convertMetersToAcres(areaSqMeters)}.`;
    } else if (table === 'LINE' && lengthLnMeters != null) {
      message = `Successfully updated ${featureType} to total ${convertMetersToMiles(lengthLnMeters)}.`;
    } else {
      message = `Successfully updated ${featureType}.`;
    }

    return { message, featureId: result.featureId, statusDescription: result.statusDescription };
  } catch (error) {
    logger.error('Error updating feature:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    if (error instanceof FeatureServiceQueryError && error.layerName === 'sgma') {
      const message = error.isTimeout
        ? 'Failed to update feature because the required SGMA lookup timed out.'
        : 'Failed to update feature because the required SGMA lookup failed.';

      throw new HttpsError('internal', message);
    }

    throw new HttpsError('internal', 'Failed to update feature.');
  }
};
