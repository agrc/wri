import RasterStretchRenderer from '@arcgis/core/renderers/RasterStretchRenderer.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@arcgis/core/symbols/support/symbolUtils', () => ({ renderPreviewHTML: vi.fn() }));

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

  it('renders the ecosystem score color ramp and input range in the legend', async () => {
    vi.stubGlobal('self', globalThis);
    const [{ ecosystemScore }, { RasterStretchSwatch }] = await Promise.all([
      import('./mapLayers'),
      import('./components/ReferenceData'),
    ]);
    vi.unstubAllGlobals();

    const renderer = ecosystemScore.renderer as RasterStretchRenderer;
    const legend = renderToStaticMarkup(createElement(RasterStretchSwatch, { renderer }));

    expect(legend).toContain('linear-gradient(to right, rgb(56, 168, 0), rgb(255, 255, 0), rgb(255, 0, 0))');
    expect(legend).toContain('>1.68</span>');
    expect(legend).toContain('>100</span>');
  });
});
