import type Geometry from '@arcgis/core/geometry/Geometry';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { describe, expect, it, vi } from 'vitest';
import { queryAndPrepareZoomGeometry } from './useHighlight';

describe('queryAndPrepareZoomGeometry', () => {
  it('queries the layer by FeatureID', async () => {
    const geometry = { type: 'polygon' } as Geometry;
    const queryFeatures = vi.fn().mockResolvedValue({ features: [{ geometry }] });

    const layer = {
      queryFeatures,
    } as unknown as FeatureLayer;

    const result = await queryAndPrepareZoomGeometry(layer, 42);

    expect(result).toBe(geometry);
    expect(queryFeatures).toHaveBeenCalledTimes(1);
    expect(queryFeatures).toHaveBeenCalledWith({ where: 'FeatureID=42', returnGeometry: true });
  });

  it('expands the returned geometry extent when extentScale is provided', async () => {
    const expandedExtent = { type: 'extent' } as Geometry;
    const expand = vi.fn().mockReturnValue(expandedExtent);
    const geometry = {
      extent: {
        expand,
      },
    } as unknown as Geometry;

    const layer = {
      objectIdField: 'OBJECTID',
      queryFeatures: vi.fn().mockResolvedValue({ features: [{ geometry }] }),
    } as unknown as FeatureLayer;

    const result = await queryAndPrepareZoomGeometry(layer, 7, 1.1);

    expect(expand).toHaveBeenCalledWith(1.1);
    expect(result).toBe(expandedExtent);
  });
});
