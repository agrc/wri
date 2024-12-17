import Collection from '@arcgis/core/core/Collection';
import { useContext } from 'react';
import { type Key } from 'react-aria';
import { useImmerReducer } from 'use-immer';
import { FilterContext, ProjectContext } from '.';
import { featureTypes, projectStatus } from '../data/filters';
import { generateDefinitionExpression } from '../definitionExpressionManager';

type Filter = {
  projects?: Set<Key>;
  features?: Set<Key>;
  join?: 'and' | 'or';
};

export type FilterAction =
  | {
      type: 'set' | 'reset';
      payload: Filter;
      metadata?: 'projects' | 'feature' | 'feature-join';
    }
  | {
      type: 'set';
      payload: boolean;
      metadata: 'wriFunding';
    };

type FilterState = {
  projects: Set<Key>;
  features: Set<Key>;
  join: 'or' | 'and';
  wriFunding: boolean;
};

const defaultProjectState = new Set<Key>(projectStatus.filter((x) => x.default).map(({ value }) => value));
const defaultFeatureState = new Set<Key>(featureTypes.map(({ featureType }) => featureType));

const initialState: FilterState = {
  projects: defaultProjectState,
  features: defaultFeatureState,
  join: 'or',
  wriFunding: false,
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
        case 'wriFunding': {
          draft.wriFunding = action.payload;

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
  const context = useContext(ProjectContext);
  let projectId = 0;

  if (context) {
    projectId = context.projectId ?? 0;
  }

  if (projectId > 0) {
    setDefinitionExpression(featureLayers, {
      centroids: `1=0`,
      point: `Project_ID=${projectId}`,
      line: `Project_ID=${projectId}`,
      poly: `Project_ID=${projectId}`,
    });
  } else {
    const expressions = generateDefinitionExpression(state);
    setDefinitionExpression(featureLayers, expressions);
  }

  return (
    <FilterContext.Provider
      value={{
        selectedFeatures: state.features,
        selectedProjects: state.projects,
        dispatch,
        featureLayers,
        defaultFeatureState,
        defaultProjectState,
        wriFunding: state.wriFunding,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};
