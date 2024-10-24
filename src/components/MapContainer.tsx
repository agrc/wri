import Extent from '@arcgis/core/geometry/Extent';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import EsriMap from '@arcgis/core/Map';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol';
import MapView from '@arcgis/core/views/MapView';
import LayerSelector from '@ugrc/layer-selector';
import { useMapReady } from '@ugrc/utilities/hooks';
import { useEffect, useRef, useState } from 'react';
import { useMap } from './hooks';

import '@ugrc/layer-selector/src/LayerSelector.css';
import { ReferenceLayer } from './ReferenceData';

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

const landOwnership = new VectorTileLayer({
  title: 'Land Ownership',
  id: 'reference-land-ownership',
  url: 'https://gis.trustlands.utah.gov/hosting/rest/services/Hosted/Land_Ownership_WM_VectorTile/VectorTileServer',
  visible: false,
  opacity: 0.3,
  hasLegend: true,
} as ReferenceLayer & __esri.VectorTileLayer);
const plss = new VectorTileLayer({
  title: 'Utah PLSS',
  id: 'reference-plss',
  url: 'https://tiles.arcgis.com/tiles/99lidPhWCzftIe9K/arcgis/rest/services/UtahPLSS/VectorTileServer',
  visible: false,
  opacity: 0.9,
});
const streams = new FeatureLayer({
  title: 'NHD Streams',
  id: 'reference-streams',
  url: 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahStreamsNHD/FeatureServer/0',
  fields: ['GNIS_Name'],
  definitionExpression: 'InUtah = 1 AND Submerged = 0',
  visible: false,
  labelsVisible: false,
  opacity: 0.7,
  minScale: 80000,
  maxScale: 0,
  renderer: new SimpleRenderer({
    symbol: new SimpleLineSymbol({
      style: 'solid',
      color: [115, 223, 255, 255],
      cap: 'round',
      width: 2,
    }),
  }),
  labelingInfo: [
    {
      symbol: {
        type: 'text',
        color: 'white',
        haloColor: [115, 223, 255, 255],
        haloSize: 0.7,
        font: {
          family: 'Ubuntu Mono',
          size: 12,
          weight: 'normal',
        },
      },
      labelPlacement: 'center-along',
      labelExpressionInfo: {
        expression: '$feature.GNIS_Name',
      },
      minScale: 80000,
      maxScale: 0,
    },
  ],
});
const watershedAreas = new FeatureLayer({
  title: 'Watershed Areas',
  id: 'reference-watershed-areas',
  url: 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahWatershedsArea/FeatureServer/0',
  fields: ['HUC_10', 'HU_10_Name'],
  visible: false,
  labelsVisible: false,
  opacity: 0.7,
  minScale: 2000000,
  maxScale: 0,
  renderer: new SimpleRenderer({
    symbol: new SimpleFillSymbol({
      style: 'none',
      outline: {
        type: 'simple-line',
        style: 'solid',
        width: 3,
      },
    }),
  }),
  labelingInfo: [
    {
      symbol: {
        type: 'text',
        color: 'white',
        haloColor: 'black',
        haloSize: 2,
        font: {
          family: 'Ubuntu Mono',
          size: 12,
          weight: 'normal',
        },
      },
      labelExpressionInfo: {
        expression: '$feature.HU_10_Name + TextFormatting.NewLine + $feature.HUC_10',
      },
      minScale: 100001,
      maxScale: 0,
    },
    {
      symbol: {
        type: 'text',
        color: 'white',
        haloColor: 'black',
        haloSize: 3,
        font: {
          family: 'Ubuntu Mono',
          size: 12,
          weight: 'normal',
        },
      },
      labelExpressionInfo: {
        expression: '$feature.HUC_10',
      },
      minScale: 300000,
      maxScale: 100000,
    },
  ],
});

export const MapContainer = ({ onClick }: { onClick?: __esri.ViewImmediateClickEventHandler }) => {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapComponent = useRef<EsriMap | null>(null);
  const mapView = useRef<MapView>();
  const clickHandler = useRef<IHandle>();
  const [selectorOptions, setSelectorOptions] = useState<SelectorOptions | null>(null);
  const { setMapView, addLayers } = useMap();
  const isReady = useMapReady(mapView.current);

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

  // add click event handlers
  useEffect(() => {
    if (onClick) {
      clickHandler.current = mapView.current!.on('immediate-click', onClick);
    }

    return () => {
      clickHandler.current?.remove();
    };
  }, [onClick, mapView]);

  // add the map layers
  useEffect(() => {
    if (isReady) {
      addLayers([landOwnership, plss, streams, watershedAreas]);
    }
    setMapView(mapView.current!);
  }, [isReady, mapView, addLayers, setMapView]);

  return (
    <div ref={mapNode} className="size-full">
      {selectorOptions?.view && <LayerSelector {...selectorOptions}></LayerSelector>}
    </div>
  );
};
