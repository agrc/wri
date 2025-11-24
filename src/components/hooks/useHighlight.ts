import Viewpoint from '@arcgis/core/Viewpoint';
import { useCallback, useEffect, useRef } from 'react';

type HighlightDetails = {
  layer: string;
  id: number;
};
type ZoomDetails = {
  enabled?: boolean;
  scale?: number;
  extentScale?: number;
};

const MUTED_EFFECT = 'grayscale(70%) opacity(70%) invert(10%)';
const HIGHLIGHT_EFFECT = 'drop-shadow(0px 0px 10px white) saturate(150%) opacity(100%)';

const isProjectFeatureLayerId = (id?: string | null): boolean =>
  typeof id === 'string' && id.startsWith('project-') && id.includes('-feature-');

const clearFeatureEffects = (map: __esri.Map | nullish) => {
  map?.allLayers.forEach((layer) => {
    if (layer.type === 'feature' && isProjectFeatureLayerId(layer.id)) {
      const featureLayer = layer as __esri.FeatureLayer;
      featureLayer.featureEffect = null;
    }
  });
};

const muteAllFeatures = (map: __esri.Map | nullish) => {
  map?.allLayers.forEach((layer) => {
    if (layer.type === 'feature' && isProjectFeatureLayerId(layer.id)) {
      const featureLayer = layer as __esri.FeatureLayer;
      featureLayer.featureEffect = {
        excludedEffect: MUTED_EFFECT,
      };
    }
  });
};

const queryAndPrepareZoomGeometry = async (
  view: __esri.FeatureLayerView,
  featureId: number,
  extentScale?: number,
): Promise<__esri.Geometry | null> => {
  if (!Number.isFinite(featureId)) {
    throw new Error(`Invalid feature id: ${featureId}`);
  }

  const result = await view.queryFeatures({ where: `FeatureID=${featureId}`, returnGeometry: true });
  const features = Array.isArray(result.features) ? result.features : [];

  if (features.length > 0 && features[0]?.geometry) {
    const geometry = features[0].geometry;
    return extentScale && geometry.extent ? (geometry.extent.expand(extentScale) as __esri.Geometry) : geometry;
  }

  return null;
};

export const useHighlight = (mapView: __esri.MapView | nullish) => {
  const highlightedRef = useRef<HighlightDetails | null>(null);
  const zoomRequestIdRef = useRef(0);
  const initialViewpointRef = useRef<__esri.Viewpoint | null>(null);

  const clear = useCallback(() => {
    highlightedRef.current = null;
    zoomRequestIdRef.current += 1; // invalidate pending zoom requests
    clearFeatureEffects(mapView?.map ?? null);

    if (initialViewpointRef.current && mapView) {
      mapView.goTo(initialViewpointRef.current, { duration: 1000 });
      initialViewpointRef.current = null;
    }
  }, [mapView]);

  const highlight = useCallback(
    (details: HighlightDetails, zoom?: ZoomDetails) => {
      if (!mapView) {
        return false;
      }

      const layer = mapView.map?.findLayerById(details.layer) as __esri.FeatureLayer | nullish;
      if (!layer) {
        return false;
      }

      const isAlreadySelected = highlightedRef.current?.layer === layer.id && highlightedRef.current?.id === details.id;
      if (isAlreadySelected) {
        clear();

        return false;
      }

      // clear any previous explicit effects then mute others
      clearFeatureEffects(mapView.map);
      muteAllFeatures(mapView.map);

      // apply the featureEffect to visually highlight the requested objectId
      layer.featureEffect = {
        filter: { objectIds: [details.id] },
        includedEffect: HIGHLIGHT_EFFECT,
        excludedEffect: MUTED_EFFECT,
      };

      highlightedRef.current = { layer: layer.id, id: details.id };

      // optionally zoom to feature (async)
      if (zoom?.enabled !== false) {
        const requestId = ++zoomRequestIdRef.current;

        if (!initialViewpointRef.current && mapView?.viewpoint) {
          initialViewpointRef.current = mapView.viewpoint.clone();
        }

        mapView
          .whenLayerView(layer)
          .then(async (view) => {
            if (zoomRequestIdRef.current !== requestId) {
              return;
            }

            try {
              const targetGeometry = await queryAndPrepareZoomGeometry(
                view as __esri.FeatureLayerView,
                details.id,
                zoom?.extentScale,
              );

              if (zoomRequestIdRef.current !== requestId || !targetGeometry) {
                return;
              }

              const isExpandedExtent = zoom?.extentScale && targetGeometry.extent;
              mapView.goTo(
                new Viewpoint({
                  targetGeometry,
                  scale: zoom?.scale ?? (isExpandedExtent ? undefined : 4500),
                }),
                { duration: 1000 },
              );
            } catch (err) {
              if (zoomRequestIdRef.current === requestId) {
                console.error('Error querying features for highlight:', err);
              }
            }
          })
          .catch((err) => {
            if (zoomRequestIdRef.current === requestId) {
              console.error('Error getting layer view for highlight:', err);
            }
          });
      }

      return true;
    },
    [mapView, clear],
  );

  useEffect(() => {
    return () => {
      clear();
    };
  }, [clear]);

  return { highlight, clear };
};

export default useHighlight;
