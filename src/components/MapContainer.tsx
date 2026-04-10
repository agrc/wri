import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Field from '@arcgis/core/layers/support/Field';
import EsriMap from '@arcgis/core/Map';
import OpacityVariable from '@arcgis/core/renderers/visualVariables/OpacityVariable';
import MapView from '@arcgis/core/views/MapView';
import type { LayerSelectorProps } from '@ugrc/utah-design-system';
import { BusyBar, HomeButton, LayerSelector } from '@ugrc/utah-design-system';
import { useMapReady, useViewLoading, utahMercatorExtent } from '@ugrc/utilities/hooks';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  blmDistricts,
  centroids,
  fireThreats,
  forestService,
  landOwnership,
  lines,
  plss,
  points,
  polygons,
  precipitation,
  rangeSites,
  regions,
  sageGrouse,
  stewardship,
  streams,
  watershedAreas,
} from '../mapLayers.ts';
import { ProjectContext, useFeatureSelection } from './contexts';
import { getFeatureKindFromLayerId } from './featureSelection';
import { useMap, useProjectNavigation } from './hooks';
import { NavigationHistory } from './NavigationHistory';
import { PrintMap } from './PrintMap.tsx';
import { Tooltip } from './Tooltip.tsx';

type ExtentQueryResult = {
  extent: __esri.Extent;
  count: number;
};

export const MapContainer = () => {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapComponent = useRef<EsriMap | null>(null);
  const mapView = useRef<MapView | null>(null);
  const [selectorOptions, setSelectorOptions] = useState<LayerSelectorProps['options'] | null>(null);
  const { setMapView, addLayers } = useMap();
  const isReady = useMapReady(mapView.current);
  const isLoading = useViewLoading(mapView.current);
  const operationalLayers = useRef<__esri.FeatureLayer[]>([]);
  const [layersReady, setLayersReady] = useState(false);
  const hasAddedLayers = useRef(false);
  const projectFeatureClickHandler = useRef<__esri.Handle | null>(null);
  const projectContext = useContext(ProjectContext);
  const { clearSelection, isMapSelectionEnabled, selectFeature } = useFeatureSelection();
  let currentProject = 0;

  if (projectContext) {
    currentProject = projectContext.projectId ?? 0;
  }

  // setup the Map
  useEffect(() => {
    if (!mapNode.current || !setMapView) {
      return;
    }

    mapComponent.current = new EsriMap();

    mapView.current = new MapView({
      container: mapNode.current,
      map: mapComponent.current,
      extent: utahMercatorExtent,
      popup: {
        dockEnabled: true,
        visibleElements: {
          collapseButton: false,
        },
        dockOptions: {
          position: 'top-right',
          buttonEnabled: false,
          breakpoint: false,
        },
      },
      constraints: {
        snapToZoom: false,
      },
      ui: {
        components: ['zoom'],
      },
    });

    setMapView(mapView.current);

    const selectorOptions: LayerSelectorProps['options'] = {
      view: mapView.current,
      quadWord: import.meta.env.VITE_DISCOVER,
      basemaps: ['Hybrid', 'Lite', 'Terrain', 'Topo', 'Color IR', 'High Contrast'],
      position: 'top-right',
    };

    setSelectorOptions(selectorOptions);

    return () => {
      mapView.current?.destroy();
      mapComponent.current?.destroy();
    };
  }, [setMapView]);

  // add the map layers (only once)
  useEffect(() => {
    if (!isReady || hasAddedLayers.current) {
      if (!isReady) {
        setLayersReady(false);
        hasAddedLayers.current = false;
      }

      return;
    }

    // layers are stacked on top of each other in a reverse order from how they are listed
    // e.g. land ownership is on the very bottom and centroids are on the very top
    const referenceLayers = [
      landOwnership,
      plss,
      streams,
      watershedAreas,
      fireThreats,
      precipitation,
      rangeSites,
      regions,
      blmDistricts,
      forestService,
      sageGrouse,
      stewardship,
    ];
    operationalLayers.current = [polygons, lines, points, centroids];

    addLayers(referenceLayers.concat(operationalLayers.current));
    hasAddedLayers.current = true;
    setLayersReady(true);
  }, [isReady, addLayers]);

  // creating in memory feature layers and zooming to the extent of the current project
  useEffect(() => {
    if (!isReady || !layersReady || currentProject === 0) {
      return;
    }

    const where = `Project_ID=${currentProject}`;
    const featureIdFieldName = 'FeatureID';
    const outFieldDefs = [
      { name: featureIdFieldName, type: 'integer' as const },
      { name: 'Project_ID', type: 'integer' as const },
      { name: 'TypeDescription', type: 'string' as const },
      { name: 'StatusDescription', type: 'string' as const },
      { name: 'Title', type: 'string' as const },
    ];
    const outFields = outFieldDefs.map((f) => f.name);

    const getFeatures = async () => {
      for (const layer of operationalLayers.current) {
        if (layer.id === 'feature-centroids') {
          continue;
        }

        const featureSet = await layer.queryFeatures({ where, outFields, returnGeometry: true });

        const virtualFieldName = '_opacity';
        const renderer = layer.renderer!.clone() as __esri.UniqueValueRenderer;
        renderer.visualVariables = [
          new OpacityVariable({
            field: virtualFieldName,
            stops: [
              { value: 0, opacity: 0 },
              { value: 1, opacity: 1 },
            ],
          }),
        ];

        // Use a synthetic OBJECTID (seeded from FeatureID) rather than making FeatureID the
        // objectIdField. For client-side source layers, ArcGIS auto-generates OIDs during
        // applyEdits starting from max(existing OIDs) + 1. If FeatureID were the objectIdField
        // and the source was empty (no existing features of this type), the first added feature
        // would get OID=1, overwriting the real database FeatureID. A separate OBJECTID field
        // prevents that — FeatureID remains an ordinary integer attribute that applyEdits never
        // touches.
        const fields = [
          new Field({ name: 'OBJECTID', type: 'oid' }),
          ...outFieldDefs.map((f) => new Field(f)),
          new Field({ name: virtualFieldName, type: 'double' }),
        ];

        const featureLayer = new FeatureLayer({
          id: `project-${currentProject}-` + layer.id,
          title: layer.title,
          geometryType: layer.geometryType,
          fields,
          outFields: ['*'],
          objectIdField: 'OBJECTID',
          labelingInfo: layer.labelingInfo,
          source: featureSet.features.map(
            (feature) =>
              new Graphic({
                geometry: feature.geometry,
                attributes: {
                  ...feature.attributes,
                  OBJECTID: feature.attributes[featureIdFieldName],
                  [virtualFieldName]: layer.opacity ?? 1,
                },
              }),
          ),
          renderer,
          spatialReference: layer.spatialReference,
        });

        mapView.current?.map!.add(featureLayer);
      }
    };

    getFeatures()
      .then(() => {
        const promises: Promise<ExtentQueryResult>[] = [];
        mapComponent.current!.layers.forEach((layer) => {
          if (layer.id.startsWith(`project-${currentProject}-`)) {
            const featureLayer = layer as __esri.FeatureLayer;

            const query = featureLayer.createQuery();
            query.where = featureLayer.definitionExpression;

            promises.push(featureLayer.queryExtent(query));
          }
        });

        Promise.all(promises).then((results) => {
          let combinedExtent: __esri.Extent | null = null;
          results
            .filter((x) => x.count > 0)
            .forEach((x) => {
              if (combinedExtent) {
                combinedExtent = combinedExtent.union(x.extent);
              } else {
                combinedExtent = x.extent;
              }
            });

          if (combinedExtent) {
            mapView.current?.goTo(combinedExtent);
          }
        });
      })
      .catch((error) => {
        console.error('Error fetching features for operational layers:', error);
      });
  }, [currentProject, isReady, layersReady]);

  // remove project specific layers when the project changes
  useEffect(() => {
    if (!isReady || !layersReady) {
      return;
    }

    mapComponent.current!.layers.forEach((layer) => {
      if (layer.id.startsWith('project-') && !layer.id.startsWith(`project-${currentProject}-`)) {
        mapComponent.current!.remove(layer);
        layer.destroy();
      }
    });
  }, [currentProject, isReady, layersReady]);

  // manage visibility of operational features
  useEffect(() => {
    if (!isReady || !layersReady || currentProject === 0) {
      return;
    }

    operationalLayers.current.forEach((layer) => {
      layer.visible = false;
    });
  }, [currentProject, isReady, layersReady]);

  useEffect(() => {
    if (!isReady || !layersReady || currentProject === 0 || !isMapSelectionEnabled || !mapView.current) {
      if (projectFeatureClickHandler.current) {
        projectFeatureClickHandler.current.remove();
        projectFeatureClickHandler.current = null;
      }

      return;
    }

    if (!projectFeatureClickHandler.current) {
      projectFeatureClickHandler.current = mapView.current.on('click', (event) => {
        const include = mapComponent.current?.layers
          .filter((layer) => layer.id.startsWith(`project-${currentProject}-feature-`))
          .toArray() as __esri.FeatureLayer[] | undefined;

        if (!include || include.length === 0) {
          return;
        }

        mapView
          .current!.hitTest(event, { include })
          .then((response) => {
            const match = response.results.find((result) => {
              const layerId = (result as __esri.MapViewGraphicHit).graphic?.layer?.id;

              return typeof layerId === 'string' && layerId.startsWith(`project-${currentProject}-feature-`);
            }) as __esri.MapViewGraphicHit | undefined;

            if (!match) {
              clearSelection();

              return;
            }

            const layerId = typeof match.graphic.layer?.id === 'string' ? match.graphic.layer.id : undefined;
            const kind = getFeatureKindFromLayerId(layerId);
            const featureId = Number(match.graphic.attributes?.FeatureID);

            if (!kind || !Number.isFinite(featureId)) {
              clearSelection();

              return;
            }

            selectFeature({ projectId: currentProject, kind, id: featureId }, 'map');
          })
          .catch((error) => {
            console.error('Error selecting project feature from map click:', error);
          });
      });
    }

    return () => {
      if (projectFeatureClickHandler.current) {
        projectFeatureClickHandler.current.remove();
        projectFeatureClickHandler.current = null;
      }
    };
  }, [clearSelection, currentProject, isMapSelectionEnabled, isReady, layersReady, selectFeature]);

  useProjectNavigation(mapView, operationalLayers, currentProject === 0 && layersReady);

  return (
    <>
      {mapView.current && (
        <>
          <HomeButton
            view={mapView.current}
            actions={[
              () => {
                if (projectContext?.projectId) {
                  window.location.hash = '';
                }
              },
            ]}
          />
          <NavigationHistory view={mapView.current} />
          <PrintMap view={mapView.current} position="top-right" />
          <BusyBar busy={isLoading} />
          {layersReady && (
            <Tooltip
              view={mapView.current}
              layersRef={operationalLayers}
              enabled={currentProject === 0}
              key={`${layersReady}-${currentProject === 0}`}
            />
          )}
        </>
      )}
      <div ref={mapNode} className="size-full fill-black">
        {selectorOptions?.view && <LayerSelector options={selectorOptions}></LayerSelector>}
      </div>
    </>
  );
};
