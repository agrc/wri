import * as logger from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Validates that form data is present
 * @param data - The data to validate
 * @throws HttpsError if data is null, undefined, or empty
 */
export const throwIfNoFormData = (data: unknown) => {
  if (!data) {
    logger.debug('No data provided');
    throw new HttpsError('invalid-argument', 'No data provided');
  }
};

/**
 * Converts square meters to acres and formats with US locale thousand separators
 * @param squareMeters - The area in square meters
 * @returns Formatted string with acres and "ac" suffix (e.g., "1,234.56 ac")
 */
export const convertMetersToAcres = (squareMeters: number) => {
  const meters = squareMeters * 0.00024710538187021526;
  const acres = meters.toFixed(2);

  if (Number(acres) === 0) {
    return '< 0.01 ac';
  }

  return `${Number(acres).toLocaleString('en-US')} ac`;
};

/**
 * Converts meters to miles and formats with US locale thousand separators
 * @param meters - The length in meters
 * @returns Formatted string with miles and "mi" suffix (e.g., "12.34 mi")
 */
export const convertMetersToMiles = (meters: number) => {
  const miles = (meters * 0.000621371).toFixed(2);

  if (Number(miles) === 0) {
    return '< 0.01 mi';
  }

  return `${Number(miles).toLocaleString('en-US')} mi`;
};

/**
 * Processes rollup data by origin type, sorts by space descending, and converts to acres
 * @param rollup - Array of rollup records from database
 * @param includeStreamArray - If true, includes stream array in result; if false, stream property is omitted
 * @returns Object containing county, owner, and sgma arrays, plus optional stream array
 */
export const processRollup = (
  rollup: Array<{ origin: string; name: string; extra: string; space: number }>,
  includeStreamArray = false,
) => {
  const sorted = rollup.sort((a, b) => b.space - a.space);

  const result = {
    county: sorted
      .filter((r) => r.origin === 'county')
      .map((r) => ({ name: r.name, area: convertMetersToAcres(r.space) })),
    owner: sorted
      .filter((r) => r.origin === 'owner')
      .map((r) => ({ owner: r.name, admin: r.extra, area: convertMetersToAcres(r.space) })),
    sgma: sorted.filter((r) => r.origin === 'sgma').map((r) => ({ name: r.name, area: convertMetersToAcres(r.space) })),
  };

  if (includeStreamArray) {
    return {
      ...result,
      stream: sorted
        .filter((r) => r.origin === 'nhd')
        .map((r) => ({ name: r.name, area: convertMetersToAcres(r.space) })),
    };
  }

  return result;
};

export type FeatureTable = 'POLY' | 'LINE' | 'POINT';

/**
 * Lookup table for mapping feature types to database table names
 */
export const tableLookup: Record<string, FeatureTable> = {
  'terrestrial treatment area': 'POLY',
  'aquatic/riparian treatment area': 'POLY',
  'affected area': 'POLY',
  'easement/acquisition': 'POLY',
  guzzler: 'POINT',
  'water development point feature': 'POINT',
  'other point feature': 'POINT',
  'fish passage structure': 'POINT',
  fence: 'LINE',
  pipeline: 'LINE',
  dam: 'LINE',
};

// Tag for SQL syntax highlighting (zero runtime cost — alias for String.raw)
const sql = String.raw;

/**
 * Recalculates all project-level spatial statistics, including the centroid.
 * Must be called inside a transaction after any feature create, update, or delete.
 * Uses SQL Server spatial aggregate functions.
 */
export const updateProjectStats = async (trx: import('knex').Knex.Transaction, projectId: number) => {
  await trx.raw(
    sql`UPDATE PROJECT SET
      TerrestrialSqMeters = (SELECT SUM(AreaSqMeters) FROM POLY WHERE Project_ID = :projectId AND LOWER(TypeDescription) = 'terrestrial treatment area'),
      AqRipSqMeters = (SELECT SUM(AreaSqMeters) FROM POLY WHERE Project_ID = :projectId AND LOWER(TypeDescription) = 'aquatic/riparian treatment area'),
      StreamLnMeters = (SELECT SUM(Intersection) FROM STREAM WHERE ProjectID = :projectId),
      AffectedAreaSqMeters = (SELECT SUM(AreaSqMeters) FROM POLY WHERE Project_ID = :projectId AND LOWER(TypeDescription) = 'affected area'),
      EasementAcquisitionSqMeters = (SELECT SUM(AreaSqMeters) FROM POLY WHERE Project_ID = :projectId AND LOWER(TypeDescription) = 'easement/acquisition'),
      Centroid = (
        SELECT geometry::ConvexHullAggregate(polygons.shape).STCentroid()
        FROM (
          SELECT geometry::ConvexHullAggregate(poly.Shape) AS shape FROM POLY poly WHERE poly.Project_ID = :projectId
          UNION ALL SELECT geometry::EnvelopeAggregate(line.Shape) FROM LINE line WHERE line.Project_ID = :projectId
          UNION ALL SELECT geometry::EnvelopeAggregate(point.Shape) FROM POINT point WHERE point.Project_ID = :projectId
        ) polygons
      )
    WHERE Project_ID = :projectId`,
    { projectId },
  );
};

/**
 * Determine whether a user may edit the specified project.
 *
 * Implementation mirrors the old .NET `ProjectController` logic
 */
export type PolyTreatment = {
  treatment: string;
  herbicides: string[];
};

export type PolyAction = {
  action: string;
  treatments: PolyTreatment[];
};

export type PointLineAction = {
  type: string;
  action: string;
  description: string;
};

// Categories where no actions are required
const NO_ACTION_CATEGORIES = new Set(['affected area', 'other point feature']);

// POINT categories that require action+type instead of description
const SUBTYPE_ACTION_CATEGORIES = new Set(['guzzler', 'fish passage structure']);

/**
 * Validates action data for a feature.
 * Mirrors the old .NET AttributeValidator.ValidAttributesFor() logic.
 */
export const validateActions = (
  table: FeatureTable,
  featureType: string,
  actions: PolyAction[] | PointLineAction[] | null | undefined,
): void => {
  const normalizedType = featureType.toLowerCase();

  if (NO_ACTION_CATEGORIES.has(normalizedType)) {
    return;
  }

  if (table === 'POLY') {
    const polyActions = (actions ?? []) as PolyAction[];
    if (polyActions.length === 0) {
      throw new HttpsError('invalid-argument', 'Polygon features require at least one action');
    }

    for (const polyAction of polyActions) {
      if (!polyAction.action?.trim()) {
        throw new HttpsError('invalid-argument', 'Each action must have a non-empty action name');
      }
      for (const treatment of polyAction.treatments ?? []) {
        if (!treatment.treatment?.trim()) {
          throw new HttpsError('invalid-argument', 'Each treatment must have a non-empty treatment name');
        }
      }
    }

    return;
  }

  // POINT or LINE
  const pointLineActions = (actions ?? []) as PointLineAction[];

  if (pointLineActions.length !== 1) {
    throw new HttpsError('invalid-argument', 'Point and line features require exactly one action');
  }

  const firstAction = pointLineActions[0]!;

  if (table === 'LINE' || SUBTYPE_ACTION_CATEGORIES.has(normalizedType)) {
    if (!firstAction.action?.trim() || !firstAction.type?.trim()) {
      throw new HttpsError('invalid-argument', 'This feature type requires both an action and a type');
    }
  } else {
    if (!firstAction.description?.trim()) {
      throw new HttpsError('invalid-argument', 'This feature type requires a description');
    }
  }
};

export const canEditProject = async (
  db: import('knex').Knex,
  projectId: number,
  key: string | null,
  token: string | null,
): Promise<boolean> => {
  if (!key || !token) {
    return false;
  }

  const project = await db
    .select({
      projectManagerFk: 'ProjectManager_ID',
      status: 'Status',
      features: 'Features',
    })
    .from('PROJECT')
    .where('Project_ID', projectId)
    .first();

  if (!project) {
    return false;
  }

  const user = await db
    .select({ userId: 'User_ID', userGroup: 'user_group' })
    .from('USERS')
    .where('UserKey', key)
    .andWhere('Token', token)
    .andWhere('Active', 'YES')
    .first();

  if (!user) {
    return false;
  }

  const isAdmin = user.userGroup === 'GROUP_ADMIN';

  const passesRoleCheck = !['GROUP_ANONYMOUS', 'GROUP_PUBLIC'].includes(user.userGroup.toUpperCase());

  const passesFeaturesCheck = project.features.toUpperCase() !== 'NO' || isAdmin;
  const passesStatusCheck = !['CANCELLED', 'COMPLETED'].includes(project.status.toUpperCase()) || isAdmin;

  if (!(passesRoleCheck && passesFeaturesCheck && passesStatusCheck)) {
    return false;
  }

  if (isAdmin || user.userId === project.projectManagerFk) {
    return true;
  }

  const contributor = await db
    .select('Contributor_ID')
    .from('CONTRIBUTOR')
    .where('User_FK', user.userId)
    .andWhere('Project_FK', projectId)
    .first();

  return contributor != null;
};
