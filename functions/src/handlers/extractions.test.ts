import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeometryJSON } from './extractions.js';
import { formatAcres, queryFeatureService } from './extractions.js';

// Mock the ArcGIS modules before importing
vi.mock('@arcgis/core/geometry/projection.js', () => ({
  load: vi.fn().mockResolvedValue(undefined),
  project: vi.fn(),
}));

vi.mock('@arcgis/core/geometry/operators/areaOperator.js', () => ({
  execute: vi.fn(),
}));

vi.mock('@arcgis/core/geometry/operators/lengthOperator.js', () => ({
  execute: vi.fn(),
}));

vi.mock('@arcgis/core/geometry/operators/intersectionOperator.js', () => ({
  execute: vi.fn(),
}));

vi.mock('@arcgis/core/geometry/operators/unionOperator.js', () => ({
  execute: vi.fn(),
}));

/**
 * Test polygon created in ArcGIS Pro
 * Expected intersection results (planar measurements in UTM Zone 12N):
 * - SALT LAKE: 5,825.92 acres
 * - DAVIS: 3,108.29 acres
 * - SUMMIT: 1,271.42 acres
 * - MORGAN: 582.50 acres
 */
const testPolygon: GeometryJSON = {
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
};

describe('extractions', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('formatAcres', () => {
    it('should format acres correctly with comma separators', () => {
      const squareMeters = 23576683;
      const result = formatAcres(squareMeters);

      expect(result).toBe('5,825.92 ac');
    });

    it('should handle small areas', () => {
      const squareMeters = 10;
      const result = formatAcres(squareMeters);

      expect(result).toBe('< 0.01 ac');
    });
  });

  describe('queryFeatureService', () => {
    it('should query feature service with correct parameters', async () => {
      const mockResponse = {
        features: [
          {
            attributes: { NAME: 'SALT LAKE' },
            geometry: {
              type: 'polygon' as const,
              rings: [
                [
                  [-12445996, 4996103],
                  [-12423283, 4983110],
                  [-12424733, 4980576],
                ],
              ],
              spatialReference: { wkid: 3857 },
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const serviceUrl = 'https://example.com/FeatureServer/0';
      const result = await queryFeatureService(serviceUrl, testPolygon, ['NAME']);

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(serviceUrl));
      expect(result.features).toHaveLength(1);
      expect(result.features[0]?.attributes.NAME).toBe('SALT LAKE');
    });

    it('should handle service errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: { message: 'Service error' } }),
      });

      const serviceUrl = 'https://example.com/FeatureServer/0';

      await expect(queryFeatureService(serviceUrl, testPolygon, ['NAME'])).rejects.toThrow('Service error');
    });
  });
});
