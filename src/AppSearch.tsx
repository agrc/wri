import Basemap from '@arcgis/core/Basemap';
import esriConfig from '@arcgis/core/config.js';
import Graphic from '@arcgis/core/Graphic';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import type { EventHandler } from '@arcgis/lumina';
import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-sketch';
import '@arcgis/map-components/components/arcgis-zoom';
import { arcgisToGeoJSON } from '@terraformer/arcgis';
import { utahMercatorExtent } from '@ugrc/utilities/hooks';
import { geoJSONToWkt } from 'betterknown';
import { useCallback, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useShapefileUpload } from './hooks/useShapefileUpload';

const ErrorFallback = ({ error }: { error: Error }) => {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: 'red' }}>{error.message}</pre>
    </div>
  );
};

esriConfig.assetsPath = import.meta.env.MODE === 'production' ? '/wri/js/ugrc/assets' : '/js/ugrc/assets';

const basemap = new Basemap({
  baseLayers: [
    new WebTileLayer({
      urlTemplate: `https://discover.agrc.utah.gov/login/path/${import.meta.env.VITE_DISCOVER}/tiles/utah/{level}/{col}/{row}`,
      copyright: 'Hexagon',
    }),
  ],
  referenceLayers: [
    new WebTileLayer({
      urlTemplate: `https://discover.agrc.utah.gov/login/path/${import.meta.env.VITE_DISCOVER}/tiles/overlay_basemap/{level}/{col}/{row}`,
      copyright: 'UGRC',
    }),
  ],
});

// @ts-expect-error the types are wrong, you can pass a partial constraints object
const constraints: __esri.View2DConstraints = { snapToZoom: false };

export default function App() {
  const mapRef = useRef<HTMLArcgisMapElement>(null);
  const areaOfInterestNode = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLArcgisSketchElement>(null);

  const handleUploadSuccess = useCallback(({ geometry, wkt3857 }: { geometry: __esri.Geometry; wkt3857: string }) => {
      const graphicsLayer = searchRef.current?.layer as __esri.GraphicsLayer | undefined;

      if (!graphicsLayer) {
        throw new Error('Search graphics layer not found');
      }

      graphicsLayer.removeAll();
      const graphic = new Graphic({ geometry, symbol: searchRef.current?.polygonSymbol });
      graphicsLayer.add(graphic);

      if (!areaOfInterestNode.current) {
        throw new Error('Area of interest input node not found');
      }

      areaOfInterestNode.current.value = wkt3857;

      if (mapRef.current?.view) {
        void mapRef.current.view.goTo(geometry.extent?.clone().expand(1.2));
      }
  }, []);

  const {
    error: shapefileError,
    handleFileChange,
    isLoading,
  } = useShapefileUpload({
    allowedGeometryTypes: ['polygon'],
    onSuccess: handleUploadSuccess,
  });

  const onSketchPropertyChange: EventHandler<HTMLArcgisSketchElement['arcgisPropertyChange']> = (event) => {
    // clear any existing graphics when activating the draw tool
    if (event.target.state === 'active') {
      (searchRef.current?.layer as __esri.GraphicsLayer).removeAll();
      if (areaOfInterestNode.current) {
        areaOfInterestNode.current.value = '';
      }
    }
  };

  const onSketchCreate: EventHandler<HTMLArcgisSketchElement['arcgisCreate']> = (event) => {
    const { state, graphic } = event.detail;

    if (state === 'complete') {
      const geometry = graphic.geometry;
      if (geometry) {
        const esriJson = geometry.toJSON();
        const geoJson = arcgisToGeoJSON(esriJson);
        const wkt = geoJSONToWkt(geoJson);

        if (!areaOfInterestNode.current) {
          throw new Error('Area of interest input node not found');
        }

        areaOfInterestNode.current.value = wkt;
      }
    }
  };

  return (
    <section className="h-96">
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <div className="px-2">
          <h2>Area of Interest</h2>
          <div className="flex w-fit items-center gap-4 py-3">
            <p>Draw a polygon on the map using the tools below or ...</p>
            <label>
              <span className="text-sm">Upload a shapefile (zipped .shp, .shx, .dbf, .prj)</span>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                disabled={isLoading}
                className="block cursor-pointer rounded border border-dashed border-zinc-400 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              />
              {shapefileError && <p className="pt-1 text-sm text-red-600">{shapefileError}</p>}
              {isLoading && !shapefileError && <p className="pt-1 text-sm text-zinc-600">Processing shapefile…</p>}
            </label>
          </div>
          <input ref={areaOfInterestNode} id="aoiGeometry" type="text" className="hidden" />
        </div>
        <arcgis-map
          ref={mapRef}
          className="rounded-md border"
          basemap={basemap}
          extent={utahMercatorExtent.expand(1.15)}
          constraints={constraints}
        >
          <arcgis-zoom slot="top-left"></arcgis-zoom>
          <arcgis-sketch
            ref={searchRef}
            availableCreateTools={['polygon', 'rectangle']}
            // deactivate tool after one graphic is created
            creationMode="single"
            hideCreateToolsCircle
            hideCreateToolsPoint
            hideCreateToolsPolyline
            hideDeleteButton
            hideDuplicateButton
            hideLabelsToggle
            hideSelectionCountLabel
            hideSelectionToolsLassoSelection
            hideSelectionToolsRectangleSelection
            hideSettingsMenu
            hideSnappingControls
            hideTooltipsToggle
            hideUndoRedoMenu
            onarcgisCreate={onSketchCreate}
            onarcgisPropertyChange={onSketchPropertyChange}
            slot="top-right"
          ></arcgis-sketch>
        </arcgis-map>
      </ErrorBoundary>
    </section>
  );
}
