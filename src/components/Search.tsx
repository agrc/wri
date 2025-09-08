import '@arcgis/map-components/components/arcgis-search';
import { blmDistricts, centroids, forestService, regions } from '../mapLayers';
import './Search.css';

type SearchProps = {
  view: __esri.MapView;
};

const clonedCentroids = centroids.clone();
clonedCentroids.definitionExpression = null;

const sources: (Partial<__esri.LayerSearchSource> | Partial<__esri.LocatorSearchSource>)[] = [
  {
    layer: regions,
    searchFields: ['DWR_REGION'],
    displayField: 'DWR_REGION',
    exactMatch: false,
    name: regions.title ?? 'DWR Regions',
    placeholder: 'example: SERO',
    suggestionsEnabled: true,
    resultGraphicEnabled: true,
  },
  {
    layer: blmDistricts,
    searchFields: ['FO_NAME'],
    displayField: 'FO_NAME',
    exactMatch: false,
    name: blmDistricts.title ?? 'BLM Districts',
    placeholder: 'example: Fillmore',
    suggestionsEnabled: true,
    resultGraphicEnabled: true,
  },
  {
    layer: forestService,
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

export function Search({ view }: SearchProps) {
  return (
    <arcgis-search
      all-placeholder="Search for anything"
      include-default-sources-disabled
      location-disabled={true}
      popup-disabled={true}
      // @ts-expect-error could not figure out how to make this type work
      sources={sources}
      view={view}
    ></arcgis-search>
  );
}
