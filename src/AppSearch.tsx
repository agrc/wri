import Basemap from '@arcgis/core/Basemap';
import esriConfig from '@arcgis/core/config.js';
import Graphic from '@arcgis/core/Graphic';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import type { EventHandler } from '@arcgis/lumina';
import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-sketch';
import '@arcgis/map-components/components/arcgis-zoom';
import { arcgisToGeoJSON } from '@terraformer/arcgis';
import { Button, FileInput } from '@ugrc/utah-design-system';
import { utahMercatorExtent } from '@ugrc/utilities/hooks';
import { geoJSONToWkt } from 'betterknown';
import { useCallback, useEffect, useRef } from 'react';
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

const mapNavigation: __esri.Navigation = {
  // @ts-expect-error the types are wrong, you can pass a partial constraints object
  actionMap: {
    mouseWheel: 'none',
  },
};

export default function App() {
  const mapRef = useRef<HTMLArcgisMapElement>(null);
  const searchRef = useRef<HTMLArcgisSketchElement>(null);
  const areaOfInterestRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    areaOfInterestRef.current = document.getElementById('aoiGeometry') as HTMLInputElement;
  }, []);

  const handleUploadSuccess = useCallback(({ geometry, wkt3857 }: { geometry: __esri.Geometry; wkt3857: string }) => {
    const graphicsLayer = searchRef.current?.layer as __esri.GraphicsLayer | undefined;

    if (!graphicsLayer) {
      throw new Error('Search graphics layer not found');
    }

    graphicsLayer.removeAll();
    const graphic = new Graphic({ geometry, symbol: searchRef.current?.polygonSymbol });
    graphicsLayer.add(graphic);

    if (!areaOfInterestRef.current) {
      throw new Error('Area of interest input node not found');
    }

    areaOfInterestRef.current.value = wkt3857;

    if (mapRef.current?.view) {
      void mapRef.current.view.goTo(geometry.extent?.clone().expand(1.2));
    }
  }, []);

  const clear = () => {
    (searchRef.current?.layer as __esri.GraphicsLayer).removeAll();
    if (areaOfInterestRef.current) {
      areaOfInterestRef.current.value = '';
    }
  };

  const {
    error: shapefileError,
    handleFileChange,
    isLoading,
  } = useShapefileUpload({
    allowedGeometryTypes: ['polygon'],
    onSuccess: handleUploadSuccess,
    onClear: clear,
  });

  const onSketchPropertyChange: EventHandler<HTMLArcgisSketchElement['arcgisPropertyChange']> = (event) => {
    // clear any existing graphics when activating the draw tool
    if (event.target.state === 'active') {
      clear();
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

        if (!areaOfInterestRef.current) {
          throw new Error('Area of interest input node not found');
        }

        areaOfInterestRef.current.value = wkt;
      }
    }
  };

  return (
    <section>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <div className="px-2 dark:bg-zinc-800 dark:text-zinc-200">
          <h2>Area of Interest</h2>
          <div className="flex w-fit flex-col items-center gap-4 py-3 sm:flex-row">
            <div>
              <p className="max-w-52">Draw a polygon on the map using the tools below...</p>
              <Button className="mt-4" variant="secondary" onClick={clear}>
                Clear Area of Interest
              </Button>
            </div>
            <p>or</p>
            <FileInput
              acceptedFileTypes={['application/zip']}
              description="The .zip file should contain at least the following files: *.shp, *.dbf, *.prj"
              errorMessage={shapefileError || undefined}
              isDisabled={isLoading}
              isInvalid={!!shapefileError}
              label="Upload a shapefile"
              onSelect={handleFileChange}
              showFileSize={false}
            />
            {isLoading && !shapefileError && <p className="pt-1 text-sm text-zinc-600">Processing shapefile…</p>}
          </div>
        </div>
        <arcgis-map
          ref={mapRef}
          className="h-96 bg-white"
          basemap={basemap}
          extent={utahMercatorExtent.expand(1.15)}
          constraints={constraints}
          navigation={mapNavigation}
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
