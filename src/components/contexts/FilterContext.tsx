import Collection from '@arcgis/core/core/Collection';
import { createContext, Dispatch } from 'react';
import { type Key } from 'react-aria';
import { type Selection } from 'react-stately';
import { featureTypes, projectStatus } from '../data/filters';
import { FilterAction } from './';

const defaultProjectState = new Set<Key>(projectStatus.filter((x) => x.default).map(({ value }) => value));
const defaultFeatureState = new Set<Key>(featureTypes.map(({ featureType }) => featureType));

export const FilterContext = createContext<{
  featureLayers: __esri.Collection<__esri.FeatureLayer>;
  dispatch: Dispatch<FilterAction>;
  defaultProjectState: Selection;
  defaultFeatureState: Selection;
  selectedFeatures: Selection;
  selectedProjects: Selection;
  wriFunding: boolean;
}>({
  featureLayers: new Collection(),
  dispatch: () => {},
  defaultProjectState,
  defaultFeatureState,
  selectedFeatures: defaultProjectState,
  selectedProjects: defaultFeatureState,
  wriFunding: false,
});
