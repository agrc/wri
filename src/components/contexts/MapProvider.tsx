import { watch } from '@arcgis/core/core/reactiveUtils';
import Graphic from '@arcgis/core/Graphic';
import MapView from '@arcgis/core/views/MapView';
import { useGraphicManager } from '@ugrc/utilities/hooks';
import PropTypes from 'prop-types';
import { createContext, ReactNode, useState } from 'react';

export const MapContext = createContext<{
  mapView: MapView | null;
  setMapView: (mapView: MapView) => void;
  placeGraphic: (graphic: Graphic | Graphic[] | null) => void;
  zoom: (geometry: __esri.GoToTarget2D) => void;
  addLayers: (layers: __esri.Layer[]) => void;
  currentMapScale: number | undefined;
} | null>(null);

export const MapProvider = ({ children }: { children: ReactNode }) => {
  const [mapView, setMapView] = useState<MapView | null>(null);
  const { setGraphic } = useGraphicManager(mapView);
  const [currentMapScale, setCurrentMapScale] = useState<number | undefined>(undefined);

  const zoom = (geometry: __esri.GoToTarget2D): void => {
    if (!mapView) {
      console.warn('attempting to zoom before the mapView is set');

      return;
    }

    mapView.goTo(geometry);
  };

  const placeGraphic = (graphic: Graphic | Graphic[] | null): void => {
    setGraphic(graphic);
  };

  const addLayers = (layers: __esri.Layer[]): void => {
    if (!mapView) {
      console.warn('attempting to add a layer before the mapView is set');

      return;
    }

    if (!mapView.map) {
      console.warn('mapView does not have a map property');

      return;
    }

    mapView.map.addMany(layers);
  };

  watch(
    () => mapView?.stationary,
    (response) => {
      if (response === true) {
        setCurrentMapScale(mapView?.scale);
      }
    },
  );

  return (
    <MapContext.Provider
      value={{
        mapView,
        setMapView,
        placeGraphic,
        zoom,
        addLayers,
        currentMapScale,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

MapProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
