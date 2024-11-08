import Extent from '@arcgis/core/geometry/Extent.js';
import EsriMap from '@arcgis/core/Map.js';
import MapView from '@arcgis/core/views/MapView.js';

import LayerSelector from '@ugrc/layer-selector';
import { BusyBar } from '@ugrc/utah-design-system';
import { useMapReady, useViewLoading } from '@ugrc/utilities/hooks';
import { useEffect, useRef, useState } from 'react';
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
import { useMap } from './hooks';

import '@ugrc/layer-selector/src/LayerSelector.css';

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

const statewide = new Extent({
  xmax: -11762120.612131765,
  xmin: -13074391.513731329,
  ymax: 5225035.106177688,
  ymin: 4373832.359194187,
  spatialReference: {
    wkid: 3857,
  },
});

export const MapContainer = () => {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapComponent = useRef<EsriMap | null>(null);
  const mapView = useRef<MapView>();
  const [selectorOptions, setSelectorOptions] = useState<SelectorOptions | null>(null);
  const { setMapView, addLayers } = useMap();
  const isReady = useMapReady(mapView.current);
  const isLoading = useViewLoading(mapView.current);

  // setup the Map
  useEffect(() => {
    if (!mapNode.current || !setMapView) {
      return;
    }

    mapComponent.current = new EsriMap();

    mapView.current = new MapView({
      container: mapNode.current,
      map: mapComponent.current,
      extent: statewide,
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
      addLayers([
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
        polygons,
        lines,
        points,
        centroids,
      ]);
    }
    setMapView(mapView.current!);
  }, [isReady, mapView, addLayers, setMapView]);

  return (
    <>
      <BusyBar busy={isLoading} />
      <div ref={mapNode} className="size-full">
        {selectorOptions?.view && <LayerSelector {...selectorOptions}></LayerSelector>}
      </div>
    </>
  );
};
