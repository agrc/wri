import Basemap from '@arcgis/core/Basemap';
import esriConfig from '@arcgis/core/config.js';
import WebTileLayer from '@arcgis/core/layers/WebTileLayer';
import type { EventHandler } from '@arcgis/lumina';
import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-sketch';
import '@arcgis/map-components/components/arcgis-zoom';
import { arcgisToGeoJSON } from '@terraformer/arcgis';
import { Button, ToggleButton } from '@ugrc/utah-design-system';
import { utahMercatorExtent } from '@ugrc/utilities/hooks';
import { geoJSONToWkt } from 'betterknown';
import { useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

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
  const [showDrawTools, setShowDrawTools] = useState(false);

  const areaOfInterestNode = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLArcgisSketchElement>(null);

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
          <div className="flex w-fit gap-2 py-3">
            <span>
              <ToggleButton onChange={() => setShowDrawTools(!showDrawTools)} isSelected={showDrawTools}>
                Draw a polygon
              </ToggleButton>
            </span>
            <span>
              <Button isDisabled>Upload a shapefile</Button>
            </span>
          </div>
          <input ref={areaOfInterestNode} id="aoiGeometry" type="text" className="hidden" />
        </div>
        <arcgis-map
          className="rounded-md border"
          basemap={basemap}
          extent={utahMercatorExtent.expand(1.15)}
          constraints={constraints}
        >
          <arcgis-zoom slot="top-left"></arcgis-zoom>
          {showDrawTools && (
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
          )}
        </arcgis-map>
      </ErrorBoundary>
    </section>
  );
}
