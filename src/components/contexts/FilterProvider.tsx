import Collection from '@arcgis/core/core/Collection';
import { createContext, Dispatch } from 'react';
import { type Key } from 'react-aria';
import { type Selection } from 'react-stately';
import { useImmerReducer } from 'use-immer';
import { featureTypes, projectStatus } from '../data/filters';

export type Filter = {
  projects?: Set<Key>;
  features?: {
    types?: Set<Key>;
    join?: 'and' | 'or';
  };
};

export type FilterAction = {
  type: 'set' | 'reset';
  payload: Filter;
  metadata?: 'projects' | 'feature' | 'feature-join';
};

type FilterState = {
  projects: Set<Key>;
  features: {
    types: Set<Key>;
    join: 'or' | 'and';
  };
};

const defaultProjectState = new Set<Key>(projectStatus.filter((x) => x.default).map(({ value }) => value));
const defaultFeatureState = new Set<Key>(featureTypes.map(({ featureType }) => featureType));

const initialState: FilterState = {
  projects: defaultProjectState,
  features: {
    types: defaultFeatureState,
    join: 'or',
  },
};

export const FilterContext = createContext<{
  featureLayers: __esri.Collection<__esri.FeatureLayer>;
  dispatch: Dispatch<FilterAction>;
  defaultProjectState: Selection;
  defaultFeatureState: Selection;
  selectedFeatures: Selection;
  selectedProjects: Selection;
}>({
  featureLayers: new Collection(),
  dispatch: () => {},
  defaultProjectState,
  defaultFeatureState,
  selectedFeatures: defaultProjectState,
  selectedProjects: defaultFeatureState,
});

const emptySet = new Set<Key>();

const reducer = (draft: typeof initialState, action: FilterAction) => {
  switch (action.type) {
    case 'set': {
      switch (action.metadata) {
        case 'feature': {
          draft.features.types = action.payload.features?.types ?? initialState.features.types;

          break;
        }
        case 'projects': {
          draft.projects = action.payload.projects ?? emptySet;

          break;
        }
        case 'feature-join': {
          draft.features.join = action.payload.features?.join ?? initialState.features.join;

          break;
        }
      }

      return draft;
    }
    case 'reset': {
      draft = initialState;

      return draft;
    }
    default:
      return draft;
  }
};

const empty = '';
const none = '1=0';
const everything = 'all';
// if the layer type is a centroid, the field name is 'status' otherwise, it is 'statusDescription'
// feature data feature type is stored in TypeDescription
// centroids need a sub select to know if it has feature types
export const createCentroidTemplate = (types: Record<'Point' | 'Line' | 'Poly', number[]>, join: 'and' | 'or') => {
  // if there's no codes for any type, return none
  if (Object.values(types).flat().length === 0) {
    return none;
  }

  const subQueries = Object.entries(types)
    .filter(([, codes]) => codes.length > 0)
    .map(
      ([type, codes]) =>
        `(Project_ID in(select Project_ID from ${type.toUpperCase()} where TypeCode in(${codes.join()})))`,
    )
    .join(` ${join} `);

  return `(${subQueries})`;
};

const setDefinitionExpression = (layers: Collection<__esri.FeatureLayer>, expression: string) => {
  return layers.filter((x) => x.id.startsWith('feature')).forEach((layer) => (layer.definitionExpression = expression));
};

const createFeatureDefinitionExpression = (keys: Selection, join: 'and' | 'or') => {
  if (keys instanceof Set) {
    if (keys.size === 0) {
      return none;
    }

    if (keys.size === featureTypes.length) {
      return empty;
    }
  }

  if (typeof keys === 'string' && keys === everything) {
    return empty;
  }

  const codesByType = Array.from(keys).reduce(
    (acc, type) => {
      const feature = featureTypes.find(({ featureType }) => featureType === type);
      if (feature) {
        if (!acc[feature.type]) {
          acc[feature.type] = [];
        }
        acc[feature.type].push(feature.code);
      }
      return acc;
    },
    {} as Record<string, number[]>,
  );

  return createCentroidTemplate(codesByType, join);
};

const createProjectDefinitionExpression = (keys: Selection) => {
  if (keys instanceof Set) {
    if (keys.size === 0) {
      return none;
    }

    if (keys.size === projectStatus.length) {
      return empty;
    }
  }

  if (typeof keys === 'string' && keys === everything) {
    return empty;
  }

  return `Status in(${Array.from(keys)
    .map((status) => `'${status}'`)
    .join(',')})`;
};

export const createDefinitionExpression = (projects: Selection, features: { types: Selection; join: 'or' | 'and' }) => {
  const featureExpression = createFeatureDefinitionExpression(features.types, features.join);
  const projectExpression = createProjectDefinitionExpression(projects);

  if (projectExpression === empty && featureExpression === empty) {
    return {
      expression: empty,
      projects: empty,
      features: empty,
    };
  }

  // if nothing is selected in either filter, no features should be displayed
  if (projectExpression === none || featureExpression === none) {
    return {
      expression: none,
      projects: none,
      features: none,
    };
  }

  const expression = [projectExpression, featureExpression].filter((expr) => expr !== empty).join(' and ');

  return {
    expression,
    projects: projectExpression,
    features: featureExpression,
  };
};

export const FilterProvider = ({
  children,
  featureLayers,
}: {
  children: React.ReactNode;
  featureLayers: __esri.Collection<__esri.FeatureLayer>;
}) => {
  const [state, dispatch] = useImmerReducer(reducer, initialState);

  console.log('state', state);
  const expressions = createDefinitionExpression(state.projects, state.features);
  console.log('expressions', expressions);
  setDefinitionExpression(featureLayers, expressions.expression);

  return (
    <FilterContext.Provider
      value={{
        selectedFeatures: state.features.types,
        selectedProjects: state.projects,
        dispatch,
        featureLayers,
        defaultFeatureState,
        defaultProjectState,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};
