import Collection from '@arcgis/core/core/Collection';
import { type Key } from 'react-aria';
import { useImmerReducer } from 'use-immer';
import { FilterContext } from '.';
import { featureTypes, projectStatus } from '../data/filters';
import { generateDefinitionExpression } from '../definitionExpressionManager';

type Filter = {
  projects?: Set<Key>;
  features?: Set<Key>;
  join?: 'and' | 'or';
};

export type FilterAction = {
  type: 'set' | 'reset';
  payload: Filter;
  metadata?: 'projects' | 'feature' | 'feature-join';
};

type FilterState = {
  projects: Set<Key>;
  features: Set<Key>;
  join: 'or' | 'and';
};

const defaultProjectState = new Set<Key>(projectStatus.filter((x) => x.default).map(({ value }) => value));
const defaultFeatureState = new Set<Key>(featureTypes.map(({ featureType }) => featureType));

const initialState: FilterState = {
  projects: defaultProjectState,
  features: defaultFeatureState,
  join: 'or',
};

const reducer = (draft: typeof initialState, action: FilterAction) => {
  switch (action.type) {
    case 'set': {
      switch (action.metadata) {
        case 'feature': {
          draft.features = action.payload.features ?? initialState.features;

          break;
        }
        case 'projects': {
          draft.projects = action.payload.projects ?? initialState.projects;

          break;
        }
        case 'feature-join': {
          draft.join = action.payload.join ?? initialState.join;

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

const setDefinitionExpression = (
  layers: Collection<__esri.FeatureLayer>,
  expressions: {
    centroids: string;
    point: string;
    line: string;
    poly: string;
  },
) => {
  Object.entries(expressions).forEach(([key, value]) => {
    const layer = layers.find((x) => x.id === `feature-${key}`);

    if (!layer) {
      console.log('Layer not found', key);

      return;
    }

    if (layer.definitionExpression === value) {
      return;
    }

    layer.definitionExpression = value;
  });
};

export const FilterProvider = ({
  children,
  featureLayers,
}: {
  children: React.ReactNode;
  featureLayers: __esri.Collection<__esri.FeatureLayer>;
}) => {
  const [state, dispatch] = useImmerReducer(reducer, initialState);

  const expressions = generateDefinitionExpression(state);
  console.table(expressions);
  setDefinitionExpression(featureLayers, expressions);

  return (
    <FilterContext.Provider
      value={{
        selectedFeatures: state.features,
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
