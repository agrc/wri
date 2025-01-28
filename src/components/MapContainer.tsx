import EsriMap from '@arcgis/core/Map.js';
import MapView from '@arcgis/core/views/MapView.js';

import LayerSelector from '@ugrc/layer-selector';
import { BusyBar, HomeButton } from '@ugrc/utah-design-system';
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
import { useMap, useProjectNavigation } from './hooks';

import '@ugrc/layer-selector/src/LayerSelector.css';
import { NavigationHistory } from './NavigationHistory';
import { Tooltip } from './Tooltip.tsx';
import { ProjectContext } from './contexts';

type LayerFactory = {
  Factory: new () => __esri.Layer;
  url: string;
  id: string;
  opacity: number;
};
type SelectorOptions = {
  view: MapView;
  quadWord: string;
  baseLayers: Array<string | { token: string; selected: boolean } | LayerFactory>;
  overlays?: Array<string | LayerFactory>;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
};

type ExtentQueryResult = {
  extent: __esri.Extent;
  count: number;
};

export const MapContainer = () => {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapComponent = useRef<EsriMap | null>(null);
  const mapView = useRef<MapView | null>(null);
  const [selectorOptions, setSelectorOptions] = useState<SelectorOptions | null>(null);
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

    const selectorOptions: SelectorOptions = {
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
      }

      addLayers(referenceLayers.concat(operationalLayers.current));
    }
  }, [isReady, mapView, addLayers, setMapView, currentProject]);

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
          <HomeButton view={mapView.current} />
          <NavigationHistory view={mapView.current} />
          <BusyBar busy={isLoading} />
          <Tooltip view={mapView.current} layers={operationalLayers.current} enabled={currentProject === 0} />
        </>
      )}
      <div ref={mapNode} className="size-full">
        {selectorOptions?.view && <LayerSelector {...selectorOptions}></LayerSelector>}
      </div>
    </>
  );
};
