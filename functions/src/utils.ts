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

/**
 * Lookup table for mapping feature types to database table names
 */
export const tableLookup: Record<string, string> = {
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

/**
 * Determine whether a user may edit the specified project.
 *
 * Implementation mirrors the old .NET `ProjectController` logic
 */
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
