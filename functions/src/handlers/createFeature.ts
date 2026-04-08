import type Multipoint from '@arcgis/core/geometry/Multipoint.js';
import type Polygon from '@arcgis/core/geometry/Polygon.js';
import type Polyline from '@arcgis/core/geometry/Polyline.js';
import { isStreamEligibleFeatureType, normalizeHerbicides } from '@ugrc/wri-shared/feature-rules';
import type {
  CreateFeatureRequest,
  CreateFeatureResponse,
  FeatureTable,
  PointLineAction,
  PolyAction,
  RetreatmentValue,
} from '@ugrc/wri-shared/types';
import * as logger from 'firebase-functions/logger';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { Knex } from 'knex';
import { getDb } from '../database.js';
import {
  canEditProject,
  convertMetersToAcres,
  convertMetersToMiles,
  parseRetreatmentInput,
  tableLookup,
  throwIfNoFormData,
  updateProjectStats,
  validateActions,
  validateRetreatment,
} from '../utils.js';
import {
  calculateAreasAndLengths,
  extractIntersections,
  FEATURE_SERVICE_CONFIG,
  projectGeometries,
  SPATIAL_REFERENCES,
  type ExtractionCriteria,
  type IntersectionResponse,
} from './extractions.js';

// Lazy imports to avoid loading ArcGIS modules at module initialization time
async function importArcGIS() {
  const { fromJSON } = await import('@arcgis/core/geometry/support/jsonUtils.js');
  return { fromJSON };
}

/**
 * Converts an ArcGIS geometry JSON representation to OGC WKT for SQL Server.
 * Handles Multipoint, Polyline (paths), and Polygon (rings).
 */
export function geometryToWkt(geometry: Polygon | Polyline | Multipoint): string {
  const json = geometry.toJSON() as Record<string, unknown>;

  if ('points' in json) {
    const points = json.points as number[][];
    const coords = points.map(([x, y]) => `(${x} ${y})`).join(', ');
    return `MULTIPOINT (${coords})`;
  }

  if ('paths' in json) {
    const paths = json.paths as number[][][];
    if (paths.length === 1) {
      const coords = paths[0]!.map(([x, y]) => `${x} ${y}`).join(', ');
      return `LINESTRING (${coords})`;
    }
    const parts = paths.map((path) => `(${path.map(([x, y]) => `${x} ${y}`).join(', ')})`);
    return `MULTILINESTRING (${parts.join(', ')})`;
  }

  if ('rings' in json) {
    const rings = json.rings as number[][][];
    const parts = rings.map((ring) => `(${ring.map(([x, y]) => `${x} ${y}`).join(', ')})`);
    return `POLYGON (${parts.join(', ')})`;
  }

  throw new HttpsError('invalid-argument', 'Unsupported geometry type');
}

const GEOMETRY_TYPE_BY_TABLE: Record<FeatureTable, string> = {
  POLY: 'esriGeometryPolygon',
  LINE: 'esriGeometryPolyline',
  POINT: 'esriGeometryMultipoint',
};

/**
 * Inserts the AREAACTION → AREATREATMENT → AREAHERBICIDE cascade for a polygon feature.
 * Mirrors the reverse of deletePolyActions in deleteFeature.ts.
 */
export const insertPolyActions = async (trx: Knex.Transaction, featureId: number, actions: PolyAction[]) => {
  for (const action of actions) {
    const actionLookup = await trx('LU_ACTION')
      .whereRaw('LOWER(ActionDescription) = LOWER(?)', [action.action])
      .select('ActionID')
      .first();

    const [insertedAction] = await trx('AREAACTION')
      .insert({ FeatureID: featureId, ActionDescription: action.action, ActionID: actionLookup?.ActionID ?? null })
      .returning('AreaActionId');

    const areaActionId: number = (insertedAction as { AreaActionId: number }).AreaActionId;

    for (const treatment of action.treatments ?? []) {
      const treatmentLookup = await trx('LU_TREATMENTTYPE')
        .whereRaw('LOWER(TreatmentTypeDescription) = LOWER(?)', [treatment.treatment])
        .select('TreatmentTypeID')
        .first();

      const [insertedTreatment] = await trx('AREATREATMENT')
        .insert({
          AreaActionID: areaActionId,
          TreatmentTypeDescription: treatment.treatment,
          TreatmentTypeID: treatmentLookup?.TreatmentTypeID ?? null,
        })
        .returning('AreaTreatmentID');

      const areaTreatmentId: number = (insertedTreatment as { AreaTreatmentID: number }).AreaTreatmentID;

      for (const herbicide of normalizeHerbicides(treatment.herbicides)) {
        const herbicideLookup = await trx('LU_HERBICIDE')
          .whereRaw('LOWER(HerbicideDescription) = LOWER(?)', [herbicide])
          .select('HerbicideID')
          .first();

        await trx('AREAHERBICIDE').insert({
          AreaTreatmentID: areaTreatmentId,
          HerbicideDescription: herbicide,
          HerbicideID: herbicideLookup?.HerbicideID ?? null,
        });
      }
    }
  }
};

/**
 * Inserts GIS rollup rows (COUNTY, LANDOWNER, SGMA, and STREAM for POLY) from
 * the intersection results returned by extractIntersections().
 */
export const insertExtractedGis = async (
  trx: Knex.Transaction,
  featureId: number,
  table: FeatureTable,
  projectId: number,
  intersections: IntersectionResponse,
) => {
  for (const result of intersections.county ?? []) {
    const countyName = (result as Record<string, string | number>)['name'] as string;
    await trx.raw(
      `INSERT INTO [dbo].[COUNTY] (FeatureID, FeatureClass, County, Intersection, County_ID)
       VALUES (?, ?, ?, ?, (SELECT Code FROM [dbo].[LU_COUNTY] WHERE LOWER(Value) = LOWER(?)))`,
      [featureId, table, countyName, result.size, countyName],
    );
  }

  for (const result of intersections.landowner ?? []) {
    const r = result as Record<string, string | number>;
    await trx('LANDOWNER').insert({
      FeatureID: featureId,
      FeatureClass: table,
      Owner: r['owner'],
      Admin: r['admin'],
      Intersection: result.size,
    });
  }

  for (const result of intersections.sgma ?? []) {
    await trx('SGMA').insert({
      FeatureID: featureId,
      FeatureClass: table,
      SGMA: (result as Record<string, string | number>)['area_name'],
      Intersection: result.size,
    });
  }

  if (table === 'POLY') {
    for (const result of intersections.stream ?? []) {
      await trx('STREAM').insert({
        FeatureID: featureId,
        ProjectID: projectId,
        StreamDescription: (result as Record<string, string | number>)['fcode_text'],
        Intersection: result.size,
      });
    }
  }
};

/**
 * Core transaction body — exported for unit testing.
 * Inserts the feature row plus all dependent rows (actions, GIS rollups, project stats).
 */
export const createFeatureTransaction = async (
  trx: Knex.Transaction,
  projectId: number,
  featureType: string,
  table: FeatureTable,
  wkt: string,
  retreatment: RetreatmentValue,
  actions: PolyAction[] | PointLineAction[] | null,
  areaSqMeters: number | null,
  lengthLnMeters: number | null,
  intersections: IntersectionResponse,
): Promise<{ featureId: number; statusDescription: string | null }> => {
  // Overlap check for POLY features
  if (table === 'POLY') {
    const overlapResult = await trx.raw<{ overlap_count: number }[]>(
      `SELECT COUNT(*) as overlap_count
       FROM [dbo].[POLY] p
       WHERE LOWER(p.TypeDescription) = LOWER(?) AND p.Project_ID = ?
         AND p.Shape.STRelate(geometry::STGeomFromText(?, 3857), '2********') = 1`,
      [featureType, projectId, wkt],
    );

    const overlapCount: number = (overlapResult as unknown as { overlap_count: number }[])?.[0]?.overlap_count ?? 0;

    if (overlapCount > 0) {
      throw new HttpsError('already-exists', `Feature overlaps with an existing ${featureType} in this project`);
    }
  }

  // Look up project status for StatusDescription and StatusCode
  const project = await trx('PROJECT')
    .select({ status: 'Status', statusCode: 'StatusID' })
    .where('Project_ID', projectId)
    .first();
  const statusDescription: string | null = project?.status ?? null;
  const statusCode: number | null = project?.statusCode ?? null;

  // Look up TypeCode (LU_FEATURETYPE)
  const typeRow = await trx('LU_FEATURETYPE')
    .whereRaw('LOWER(FeatureTypeDescription) = LOWER(?)', [featureType])
    .select({ typeCode: 'FeatureTypeID' })
    .first();
  const typeCode: number | null = typeRow?.typeCode ?? null;

  let featureId: number;

  if (table === 'POLY') {
    const rows = await trx.raw(
      `INSERT INTO [dbo].[POLY] (TypeDescription, Retreatment, Project_ID, Shape, TypeCode, StatusDescription, StatusCode, AreaSqMeters)
       OUTPUT INSERTED.FeatureID
       VALUES (?, ?, ?, geometry::STGeomFromText(?, 3857), ?, ?, ?, ?)`,

      [featureType, retreatment, projectId, wkt, typeCode, statusDescription, statusCode, areaSqMeters],
    );

    featureId = (rows as unknown as { FeatureID: number }[])[0]!.FeatureID;

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

    const rows = await trx.raw(
      `INSERT INTO [dbo].[LINE] (TypeDescription, FeatureSubTypeDescription, ActionDescription, Description, Shape, Project_ID, StatusDescription, StatusCode, TypeCode, FeatureSubTypeID, ActionID, LengthLnMeters)
       OUTPUT INSERTED.FeatureID
       VALUES (?, ?, ?, ?, geometry::STGeomFromText(?, 3857), ?, ?, ?, ?, ?, ?, ?)`,

      [
        featureType,
        action.type,
        action.action,
        action.description?.trim() || null,
        wkt,
        projectId,
        statusDescription,
        statusCode,
        typeCode,
        subTypeRow?.id ?? null,
        actionRow?.id ?? null,
        lengthLnMeters,
      ],
    );

    featureId = (rows as unknown as { FeatureID: number }[])[0]!.FeatureID;
  } else {
    // POINT
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

    const rows = await trx.raw(
      `INSERT INTO [dbo].[POINT] (TypeDescription, FeatureSubTypeDescription, ActionDescription, Description, Shape, Project_ID, StatusDescription, StatusCode, TypeCode, FeatureSubTypeID, ActionID)
       OUTPUT INSERTED.FeatureID
       VALUES (?, ?, ?, ?, geometry::STGeomFromText(?, 3857), ?, ?, ?, ?, ?, ?)`,

      [
        featureType,
        action?.type ?? null,
        action?.action ?? null,
        action?.description?.trim() || null,
        wkt,
        projectId,
        statusDescription,
        statusCode,
        typeCode,
        subTypeRow?.id ?? null,
        actionRow?.id ?? null,
      ],
    );

    featureId = (rows as unknown as { FeatureID: number }[])[0]!.FeatureID;
  }

  await insertExtractedGis(trx, featureId, table, projectId, intersections);
  await updateProjectStats(trx, projectId);

  return { featureId, statusDescription };
};

/**
 * Handler for create feature requests.
 * Validates input, checks authorization, calls the SOE-equivalent services for
 * geometry measurements and GIS intersections, then inserts the feature and all
 * related data inside a single transaction.
 */
export const createFeatureHandler = async ({ data }: CallableRequest): Promise<CreateFeatureResponse> => {
  throwIfNoFormData(data);

  try {
    const request = data as CreateFeatureRequest;
    const projectId = parseInt(request.projectId?.toString() ?? '-1', 10);
    const featureType = request.featureType?.toString() ?? '';
    const key = request.key?.toString() ?? null;
    const token = request.token?.toString() ?? null;
    const retreatment = parseRetreatmentInput(request.retreatment);
    const actions = (request.actions ?? null) as PolyAction[] | PointLineAction[] | null;
    const geometryData = request.geometry as object | null;

    if (isNaN(projectId) || projectId <= 0 || projectId > Number.MAX_SAFE_INTEGER) {
      throw new HttpsError('invalid-argument', 'Invalid project ID');
    }

    const table = tableLookup[featureType.toLowerCase()];
    if (!table) {
      throw new HttpsError('invalid-argument', 'Invalid feature type');
    }

    if (!geometryData || typeof geometryData !== 'object') {
      throw new HttpsError('invalid-argument', 'Geometry is required');
    }

    validateActions(table, featureType, actions);
    validateRetreatment(featureType, retreatment);

    const db = await getDb();

    const canEdit = await canEditProject(db, projectId, key, token);
    if (!canEdit) {
      throw new HttpsError('permission-denied', 'You do not have permission to edit this project');
    }

    logger.info('Creating feature', { projectId, featureType, table });

    const { fromJSON } = await importArcGIS();
    const geometry = fromJSON(geometryData);

    // Project geometry to UTM Zone 12N for accurate measurements
    const [projectedGeometry] = await projectGeometries([geometry], SPATIAL_REFERENCES.UTM_ZONE_12N);
    if (!projectedGeometry || !projectedGeometry.spatialReference) {
      throw new HttpsError(
        'invalid-argument',
        'Failed to project the submitted geometry to the required spatial reference.',
      );
    }

    const geometryType = GEOMETRY_TYPE_BY_TABLE[table];

    const shouldExtractStream = table === 'POLY' && isStreamEligibleFeatureType(featureType);

    // Build intersection criteria — stream only for aquatic/riparian treatment areas
    const extractCriteria: ExtractionCriteria = {
      county: { attributes: [...FEATURE_SERVICE_CONFIG.county.attributes] },
      landowner: { attributes: [...FEATURE_SERVICE_CONFIG.landowner.attributes] },
      sgma: { attributes: [...FEATURE_SERVICE_CONFIG.sgma.attributes] },
      ...(shouldExtractStream ? { stream: { attributes: [...FEATURE_SERVICE_CONFIG.stream.attributes] } } : {}),
    };

    // Measurements and GIS extractions run in parallel
    const [areasLengths, intersections] = await Promise.all([
      table !== 'POINT'
        ? calculateAreasAndLengths([projectedGeometry as object], geometryType)
        : Promise.resolve({ areas: null, lengths: null }),
      extractIntersections(projectedGeometry, extractCriteria),
    ]);

    const areaSqMeters = areasLengths.areas?.[0] ?? null;
    const lengthLnMeters = areasLengths.lengths?.[0] ?? null;

    // Convert to WKT for SQL Server storage
    const wkt = geometryToWkt(geometry);

    const { featureId, statusDescription } = await db.transaction((trx) =>
      createFeatureTransaction(
        trx,
        projectId,
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

    let message: string;
    if (table === 'POLY' && areaSqMeters != null) {
      message = `Successfully created a new ${featureType} covering ${convertMetersToAcres(areaSqMeters)}.`;
    } else if (table === 'LINE' && lengthLnMeters != null) {
      message = `Successfully created a new ${featureType} totaling ${convertMetersToMiles(lengthLnMeters)}.`;
    } else {
      message = `Successfully created a new ${featureType}.`;
    }

    return { message, featureId, statusDescription };
  } catch (error) {
    logger.error('Error creating feature:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', 'Failed to create feature.');
  }
};
