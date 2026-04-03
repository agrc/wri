import type Polygon from '@arcgis/core/geometry/Polygon.js';
import { fromJSON } from '@arcgis/core/geometry/support/jsonUtils.js';
import { describe, expect, it } from 'vitest';
import { extractIntersections, type ExtractionCriteria } from './extractions.js';

// Test polygon from ArcGIS Pro - polygon crossing Salt Lake, Davis, Summit, and Morgan counties
const testPolygon = fromJSON({
  type: 'polygon',
  rings: [
    [
      [-12445996.2817, 4996103.8417999968],
      [-12423283.255800001, 4983110.6354999989],
      [-12424733.0726, 4980576.2551999986],
      [-12447446.0985, 4993569.4614999965],
      [-12445996.2817, 4996103.8417999968],
    ],
  ],
  spatialReference: { wkid: 3857 },
}) as Polygon;

const countyCriteria: ExtractionCriteria = {
  county: {
    attributes: ['NAME'],
  },
};

// Baseline values from ArcGIS Pro (planar measurements UTM Zone 12N)
const countyBaselineValues: Record<string, number> = {
  'SALT LAKE': 5825.916598,
  DAVIS: 3108.286627,
  SUMMIT: 1271.419745,
  MORGAN: 582.49902,
};

const SQUARE_METERS_PER_ACRE = 4046.8564224;

// Tolerance for floating point comparison (in acres)
const TOLERANCE = 0.1;

describe('extractIntersections integration', () => {
  it('should return county intersections within tolerance of ArcGIS Pro baseline values', async () => {
    const results = await extractIntersections(testPolygon, countyCriteria);

    expect(results.county).toBeDefined();
    expect(results.county!.length).toBeGreaterThan(0);

    for (const result of results.county!) {
      const countyName = result.name as string;
      const baseline = countyBaselineValues[countyName];

      if (baseline) {
        const expectedSizeSquareMeters = baseline * SQUARE_METERS_PER_ACRE;
        const sizeToleranceSquareMeters = TOLERANCE * SQUARE_METERS_PER_ACRE;

        expect(result.size).toBeGreaterThan(expectedSizeSquareMeters - sizeToleranceSquareMeters);
        expect(result.size).toBeLessThan(expectedSizeSquareMeters + sizeToleranceSquareMeters);
        const sizeAcres = result.size * 0.000247105;
        const diff = Math.abs(sizeAcres - baseline);
        expect(diff).toBeLessThan(TOLERANCE);
      }
    }
  });

  it('should return results for all expected counties', async () => {
    const results = await extractIntersections(testPolygon, countyCriteria);
    const expectedCounties = Object.keys(countyBaselineValues);

    expect(results.county).toBeDefined();

    const returnedCounties = results.county!.map((r) => r.name as string);

    for (const expected of expectedCounties) {
      expect(returnedCounties).toContain(expected);
    }
  });
});
