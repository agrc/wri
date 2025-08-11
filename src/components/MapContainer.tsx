import EsriMap from '@arcgis/core/Map.js';
import MapView from '@arcgis/core/views/MapView.js';

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
import { ProjectContext } from './contexts';
import { useMap, useProjectNavigation } from './hooks';
import { NavigationHistory } from './NavigationHistory';
import { Tooltip } from './Tooltip.tsx';

type ExtentQueryResult = {
  extent: __esri.Extent;
  count: number;
};

export const MapContainer = ({ configuration }: { configuration: string }) => {
  console.log('configuration', configuration);
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapComponent = useRef<EsriMap | null>(null);
  const mapView = useRef<MapView | null>(null);
  const [selectorOptions, setSelectorOptions] = useState<LayerSelectorProps['options'] | null>(null);
  const { setMapView, addLayers } = useMap();
  const isReady = useMapReady(mapView.current);
  const isLoading = useViewLoading(mapView.current);
  const operationalLayers = useRef<__esri.FeatureLayer[]>([]);
  const projectContext = useContext(ProjectContext);
  let currentProject = 0;

  if (projectContext) {
    currentProject = projectContext.projectId ?? 0;
  }

  useProjectNavigation(mapView.current, operationalLayers.current, currentProject === 0);

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
      scale: import.meta.env.DEV ? 90000 : undefined,
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
      ui: {
        components: ['zoom'],
      },
    });

    setMapView(mapView.current);

    const selectorOptions: LayerSelectorProps['options'] = {
      view: mapView.current,
      quadWord: import.meta.env.VITE_DISCOVER,
      baseLayers: ['Hybrid', 'Lite', 'Terrain', 'Topo', 'Color IR'],
      position: 'top-right',
    };

    setSelectorOptions(selectorOptions);

    return () => {
      mapView.current?.destroy();
      mapComponent.current?.destroy();
    };
  }, [setMapView]);

  // add the map layers
  useEffect(() => {
    if (isReady) {
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

      if (currentProject === 0) {
        operationalLayers.current.forEach((x) => (x.visible = false));
      } else {
        operationalLayers.current.forEach((x) => (x.visible = true));
      }

      addLayers(referenceLayers.concat(operationalLayers.current));
    }
  }, [isReady, currentProject, addLayers]);

  // zoom to the current project
  useEffect(() => {
    if (currentProject === 0) {
      return;
    }

    const promises: Promise<ExtentQueryResult>[] = [];
    operationalLayers.current.forEach((layer) => {
      layer.visible = true;
      if (layer.id === 'feature-centroids') {
        return;
      }

      const query = layer.createQuery();
      query.where = layer.definitionExpression;

      promises.push(layer.queryExtent(query));
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
  }, [currentProject, operationalLayers.current.length]);

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
          <BusyBar busy={isLoading} />
          <Tooltip view={mapView.current} layers={operationalLayers.current} enabled={currentProject === 0} />
        </>
      )}
      <div ref={mapNode} className="size-full fill-black">
        {selectorOptions?.view && <LayerSelector options={selectorOptions}></LayerSelector>}
      </div>
    </>
  );
};
