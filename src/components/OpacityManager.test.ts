import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { describe, expect, it, vi } from 'vitest';
import { updateOpacity } from './updateOpacity';

describe('updateOpacity', () => {
  it('queries the selected feature with the object id field and applies the updated opacity', async () => {
    const feature = {
      attributes: {
        FeatureID: 42,
        OBJECTID: 42,
        _opacity: 1,
      },
    };

    const queryFeatures = vi.fn().mockResolvedValue({
      features: [feature],
    });
    const applyEdits = vi.fn().mockResolvedValue({});

    const layer = {
      objectIdField: 'OBJECTID',
      queryFeatures,
      applyEdits,
    } as unknown as FeatureLayer;

    await updateOpacity(layer, 35, 42);

    expect(queryFeatures).toHaveBeenCalledWith({
      where: 'FeatureID=42',
      outFields: ['FeatureID', '_opacity', 'OBJECTID'],
      returnGeometry: false,
    });

    expect(applyEdits).toHaveBeenCalledTimes(1);
    expect(applyEdits).toHaveBeenCalledWith({
      updateFeatures: [
        {
          attributes: {
            FeatureID: 42,
            OBJECTID: 42,
            _opacity: 0.35,
          },
        },
      ],
    });
  });

  it('does not apply edits when the queried feature is missing', async () => {
    const queryFeatures = vi.fn().mockResolvedValue({
      features: [],
    });
    const applyEdits = vi.fn();

    const layer = {
      objectIdField: 'OBJECTID',
      queryFeatures,
      applyEdits,
    } as unknown as FeatureLayer;

    await updateOpacity(layer, 35, 42);

    expect(applyEdits).not.toHaveBeenCalled();
  });
});
