import Collection from '@arcgis/core/core/Collection';
import { whenOnce } from '@arcgis/core/core/reactiveUtils';
import '@arcgis/map-components/components/arcgis-search';
import { useRef } from 'react';
import { blmDistricts, centroids, forestService, regions } from '../mapLayers';
import './Search.css';

type SearchProps = {
  view: __esri.MapView;
};

const clonedCentroids = centroids.clone();
clonedCentroids.definitionExpression = null;

const sources: (Partial<__esri.LayerSearchSource> | Partial<__esri.LocatorSearchSource>)[] = [
  {
    // We clone the layers so that the search component will put a graphic in the default graphics layer
    // rather than highlight the feature in the original layer, which would require the layer to be turned on.
    layer: regions.clone(),
    searchFields: ['DWR_REGION'],
    displayField: 'DWR_REGION',
    exactMatch: false,
    name: regions.title ?? 'DWR Regions',
    placeholder: 'example: SER',
    suggestionsEnabled: true,
    resultGraphicEnabled: true,
  },
  {
    layer: blmDistricts.clone(),
    searchFields: ['FO_NAME'],
    displayField: 'FO_NAME',
    exactMatch: false,
    name: blmDistricts.title ?? 'BLM Districts',
    placeholder: 'example: Fillmore',
    suggestionsEnabled: true,
    resultGraphicEnabled: true,
  },
  {
    layer: forestService.clone(),
    searchFields: ['LABEL_FEDERAL'],
    displayField: 'LABEL_FEDERAL',
    exactMatch: false,
    name: forestService.title ?? 'Forest Service',
    placeholder: 'example: Dixie National Forest',
    suggestionsEnabled: true,
    resultGraphicEnabled: true,
  },
  {
    layer: clonedCentroids,
    searchFields: ['Title'],
    displayField: 'Title',
    exactMatch: false,
    name: 'WRI Project Name',
    placeholder: 'example: Promontory Fire Rehab',
    suggestionsEnabled: true,
    resultGraphicEnabled: true,
  },
  {
    layer: clonedCentroids,
    searchFields: ['Project_ID'],
    displayField: 'Project_ID',
    name: 'WRI Project Id',
    placeholder: 'example: 2474',
    suggestionsEnabled: true,
    resultGraphicEnabled: true,
  },
  {
    name: 'SGID Locations',
    placeholder: 'example: 123 South Main or Sandy',
    url: 'https://masquerade.ugrc.utah.gov/arcgis/rest/services/UtahLocator/GeocodeServer',
  },
];
const sourcesCollection = new Collection(sources);

export function Search({ view }: SearchProps) {
  const searchElementRef = useRef<HTMLArcgisSearchElement>(null);

  const onSelectResult = async () => {
    const graphic = searchElementRef.current?.resultGraphic;
    if (graphic) {
      whenOnce(() => view.interacting).then(() => {
        (graphic.layer as __esri.GraphicsLayer)?.graphics.remove(graphic);
      });
    }
  };

  return (
    <arcgis-search
      ref={searchElementRef}
      onarcgisSelectResult={onSelectResult}
      allPlaceholder="Search for anything"
      includeDefaultSourcesDisabled
      locationDisabled={true}
      popupDisabled={true}
      sources={sourcesCollection}
      // @ts-expect-error this prop is not documented in the types
      view={view}
    ></arcgis-search>
  );
}
