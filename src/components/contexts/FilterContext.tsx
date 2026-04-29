import Collection from '@arcgis/core/core/Collection';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { createContext, type Dispatch } from 'react';
import { type Key } from 'react-aria';
import { type Selection } from 'react-stately';
import type { FeatureType, ProjectStatuses } from '../data/filters';
import type { FilterAction } from './';

const defaultProjectState = new Set<Key>();
const defaultFeatureState = new Set<Key>();

export const FilterContext = createContext<{
  featureLayers: Collection<FeatureLayer>;
  dispatch: Dispatch<FilterAction>;
  defaultProjectState: Selection;
  defaultFeatureState: Selection;
  selectedFeatures: Selection;
  selectedProjects: Selection;
  projectStatus: ProjectStatuses[];
  featureTypes: FeatureType[];
  filtersLoading: boolean;
  filtersError: string | null;
  wriFunding: boolean;
}>({
  featureLayers: new Collection(),
  dispatch: () => {},
  defaultProjectState,
  defaultFeatureState,
  selectedFeatures: defaultFeatureState,
  selectedProjects: defaultProjectState,
  projectStatus: [],
  featureTypes: [],
  filtersLoading: false,
  filtersError: null,
  wriFunding: false,
});
