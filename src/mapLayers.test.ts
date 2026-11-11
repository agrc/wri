import RasterStretchRenderer from '@arcgis/core/renderers/RasterStretchRenderer.js';
import { describe, expect, it, vi } from 'vitest';

describe('ecosystem score layer', () => {
  it('matches the reference web map imagery and renderer settings', async () => {
    vi.stubGlobal('self', globalThis);
    const { ecosystemScore } = await import('./mapLayers');
    vi.unstubAllGlobals();
    expect(ecosystemScore.bandIds).toEqual([0]);
    expect(ecosystemScore.interpolation).toBe('bilinear');
    expect(ecosystemScore.renderer).toBeInstanceOf(RasterStretchRenderer);
    expect(ecosystemScore.renderer?.toJSON()).toEqual({
      colorRamp: {
        type: 'multipart',
        colorRamps: [
          {
            type: 'algorithmic',
            algorithm: 'esriHSVAlgorithm',
            fromColor: [56, 168, 0, 255],
            toColor: [255, 255, 0, 255],
          },
          {
            type: 'algorithmic',
            algorithm: 'esriHSVAlgorithm',
            fromColor: [255, 255, 0, 255],
            toColor: [255, 0, 0, 255],
          },
        ],
      },
      computeGamma: false,
      dra: false,
      gamma: [1],
      numberOfStandardDeviations: 2,
      max: 255,
      min: 0,
      statistics: [[1.6849349737167358, 100, 55.7860086205702, 20.230919207988805]],
      useGamma: false,
      stretchType: 'minMax',
      type: 'rasterStretch',
    });
  });
});
