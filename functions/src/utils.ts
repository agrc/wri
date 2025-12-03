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
