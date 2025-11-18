import Viewpoint from '@arcgis/core/Viewpoint';
import { useCallback, useEffect } from 'react';

type HighlightDetails = {
  layer: string;
  id: number;
};
type ZoomDetails = {
  enabled?: boolean;
  scale?: number;
};

// useHighlight returns a stable function that highlights a feature by OBJECTID
// and optionally zooms to it. It also clears effects on unmount.
export const useHighlight = (mapView: __esri.MapView | nullish) => {
  const clearFeatureEffects = useCallback((map: __esri.Map | nullish) => {
    map?.allLayers.forEach((layer) => {
      if (layer.type === 'feature' && layer.id.startsWith('feature-')) {
        const featureLayer = layer as __esri.FeatureLayer;
        featureLayer.featureEffect = null;
      }
    });
  }, []);

  const muteAllFeatures = useCallback((map: __esri.Map | nullish) => {
    map?.allLayers.forEach((layer) => {
      if (layer.type === 'feature' && layer.id.startsWith('feature-')) {
        const featureLayer = layer as __esri.FeatureLayer;
        featureLayer.featureEffect = {
          excludedEffect: 'grayscale(70%) opacity(70%) invert(10%)',
        };
      }
    });
  }, []);

  const highlight = useCallback(
    (details: HighlightDetails, zoom?: ZoomDetails, enabled: boolean = true) => {
      if (!enabled || !mapView) {
        return false;
      }

      const layer = mapView.map?.findLayerById(details.layer) as __esri.FeatureLayer | nullish;
      if (!layer) {
        return false;
      }

      // If this feature is already highlighted, clear highlights (toggle off)
      const fe = layer.featureEffect as unknown as { filter?: { objectIds?: number[] } } | null;
      const currentObjectIds = fe?.filter?.objectIds ?? [];

      if (Array.isArray(currentObjectIds) && currentObjectIds.indexOf(details.id) !== -1) {
        clearFeatureEffects(mapView.map);

        return false;
      }

      // clear any previous explicit effects then mute others
      clearFeatureEffects(mapView.map);
      muteAllFeatures(mapView.map);

      // apply the featureEffect to visually highlight the requested objectId
      layer.featureEffect = {
        filter: { objectIds: [details.id] },
        includedEffect: 'drop-shadow(0px 0px 10px white) saturate(150%) opacity(100%)',
        excludedEffect: 'grayscale(70%) opacity(70%) invert(10%)',
      };

      // optionally zoom to feature (async)
      if (zoom?.enabled) {
        mapView
          .whenLayerView(layer)
          .then((view) => {
            (view as __esri.FeatureLayerView)
              .queryFeatures({ where: `Project_ID=${details.id}`, returnGeometry: true })
              .then((result) => {
                if (result.features.length > 0) {
                  mapView.goTo(
                    new Viewpoint({ targetGeometry: result.features[0]!.geometry, scale: zoom?.scale || 4500 }),
                    {
                      duration: 1000,
                    },
                  );
                }
              })
              .catch((err) => {
                console.error('Error querying features for highlight:', err);
              });
          })
          .catch((err) => {
            console.error('Error getting layer view for highlight:', err);
          });
      }

      return true;
    },
    [mapView, clearFeatureEffects, muteAllFeatures],
  );

  const clear = useCallback(() => {
    clearFeatureEffects(mapView?.map ?? null);
  }, [mapView, clearFeatureEffects]);

  useEffect(() => {
    return () => {
      // cleanup effects on unmount
      clearFeatureEffects(mapView?.map ?? null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { highlight, clear };
};

export default useHighlight;
