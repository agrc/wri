import { beforeEach, describe, expect, it, vi } from 'vitest';
// Mock ky with a singleton mock client exposed on the mocked module
vi.mock('ky', () => {
  const mockClient = { get: vi.fn() };

  return {
    default: {
      create: vi.fn(() => mockClient),
      // expose the client so tests can inspect & stub it
      __client: mockClient,
    },
  };
});

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
      const ky = await import('ky');
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

      const mockGet = (ky.default as any).__client.get;

      vi.mocked(mockGet).mockReturnValue({
        json: async () => mockResponse,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const serviceUrl = 'https://example.com/FeatureServer/0';
      const result = await queryFeatureService(serviceUrl, testPolygon, ['NAME']);

      expect((ky.default as any).__client.get).toHaveBeenCalledWith(
        expect.stringContaining(serviceUrl),
        expect.any(Object),
      );
      expect(result.features).toHaveLength(1);
      expect(result.features[0]?.attributes.NAME).toBe('SALT LAKE');
    });

    it('should handle service errors', async () => {
      const ky = await import('ky');

      const mockGet = (ky.default as any).__client.get;

      // Simulate a network/request error from the adapter so the helper will reject
      vi.mocked(mockGet).mockRejectedValue(new Error('Service error'));

      const serviceUrl = 'https://example.com/FeatureServer/0';

      await expect(queryFeatureService(serviceUrl, testPolygon, ['NAME'])).rejects.toThrow('Service error');
    });

    it('should handle pagination when exceededTransferLimit is true', async () => {
      const ky = await import('ky');

      // First response with exceededTransferLimit = true
      const firstResponse = {
        features: [
          {
            attributes: { NAME: 'COUNTY1' },
            geometry: {
              type: 'polygon' as const,
              rings: [
                [
                  [-1, -1],
                  [-1, 1],
                  [1, 1],
                  [1, -1],
                  [-1, -1],
                ],
              ],
              spatialReference: { wkid: 3857 },
            },
          },
          {
            attributes: { NAME: 'COUNTY2' },
            geometry: {
              type: 'polygon' as const,
              rings: [
                [
                  [-2, -2],
                  [-2, 2],
                  [2, 2],
                  [2, -2],
                  [-2, -2],
                ],
              ],
              spatialReference: { wkid: 3857 },
            },
          },
        ],
        exceededTransferLimit: true,
      };

      // Second response with exceededTransferLimit = false
      const secondResponse = {
        features: [
          {
            attributes: { NAME: 'COUNTY3' },
            geometry: {
              type: 'polygon' as const,
              rings: [
                [
                  [-3, -3],
                  [-3, 3],
                  [3, 3],
                  [3, -3],
                  [-3, -3],
                ],
              ],
              spatialReference: { wkid: 3857 },
            },
          },
        ],
        exceededTransferLimit: false,
      };

      const mockGet = (ky.default as any).__client.get;

      vi.mocked(mockGet)
        .mockReturnValueOnce({
          json: async () => firstResponse,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .mockReturnValueOnce({
          json: async () => secondResponse,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

      const serviceUrl = 'https://example.com/FeatureServer/0';
      const result = await queryFeatureService(serviceUrl, testPolygon, ['NAME']);

      // Should have called get twice - once for each page
      expect((ky.default as any).__client.get).toHaveBeenCalledTimes(2);

      // First call should have resultOffset=0 encoded in the adapter searchParams
      expect((ky.default as any).__client.get).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(serviceUrl),
        expect.objectContaining({ searchParams: expect.objectContaining({ resultOffset: 0 }) }),
      );

      // Second call should have resultOffset=2 (number of features from first page)
      expect((ky.default as any).__client.get).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(serviceUrl),
        expect.objectContaining({ searchParams: expect.objectContaining({ resultOffset: 2 }) }),
      );

      // Should return all 3 features
      expect(result.features).toHaveLength(3);
      expect(result.features[0]?.attributes.NAME).toBe('COUNTY1');
      expect(result.features[1]?.attributes.NAME).toBe('COUNTY2');
      expect(result.features[2]?.attributes.NAME).toBe('COUNTY3');
    });
  });
});
