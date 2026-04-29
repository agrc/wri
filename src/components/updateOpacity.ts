import Collection from '@arcgis/core/core/Collection';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';

export const updateOpacity = async (
  layer: FeatureLayer | Collection<FeatureLayer> | null,
  value: number,
  id?: number,
) => {
  if (!layer) {
    return;
  }

  // multiple layers
  if (layer instanceof Collection) {
    layer.forEach((lyr) => {
      lyr.opacity = value / 100;
    });

    return;
  }

  // single layer, no specific feature
  if (!id) {
    layer.opacity = value / 100;

    return;
  }

  // specific feature
  const objectIdField = layer.objectIdField || 'OBJECTID';
  const results = await layer.queryFeatures({
    where: `FeatureID=${id}`,
    outFields: ['FeatureID', '_opacity', objectIdField],
    returnGeometry: false,
  });

  if (results.features.length === 0) {
    return;
  }

  try {
    await layer.applyEdits({
      updateFeatures: results.features.map((feature) => {
        feature.attributes._opacity = value / 100;
        return feature;
      }),
    });
  } catch (error) {
    console.error('Failed to set opacity:', error);
  }
};
