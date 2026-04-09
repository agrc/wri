import Collection from '@arcgis/core/core/Collection';
import { useContext, useEffect, useMemo, useRef } from 'react';
import { type Key } from 'react-aria';
import { useImmerReducer } from 'use-immer';
import { FilterContext, ProjectContext } from '.';
import { useEditingDomains } from '../../hooks/useEditingDomains';
import { getDefaultFeatureState, getDefaultProjectState, normalizeFilterOptions } from '../data/filters';
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

const defaultProjectState = new Set<Key>();
const defaultFeatureState = new Set<Key>();
const defaultJoin = 'or' as const;

const initialState: FilterState = {
  projects: defaultProjectState,
  features: defaultFeatureState,
  join: defaultJoin,
  wriFunding: false,
};

const reducer = (draft: typeof initialState, action: FilterAction) => {
  switch (action.type) {
    case 'set': {
      switch (action.metadata) {
        case 'feature': {
          draft.features = action.payload.features ?? new Set<Key>();

          break;
        }
        case 'projects': {
          draft.projects = action.payload.projects ?? new Set<Key>();

          break;
        }
        case 'feature-join': {
          draft.join = action.payload.join ?? defaultJoin;

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
      draft.projects = action.payload.projects ?? new Set<Key>();
      draft.features = action.payload.features ?? new Set<Key>();
      draft.join = action.payload.join ?? defaultJoin;
      draft.wriFunding = false;

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
  const editingDomainsQuery = useEditingDomains(true);
  const context = useContext(ProjectContext);
  const initializedFilters = useRef(false);
  let projectId = 0;

  if (context) {
    projectId = context.projectId ?? 0;
  }

  const filterOptions = useMemo(() => {
    if (!editingDomainsQuery.data) {
      return null;
    }

    return normalizeFilterOptions(editingDomainsQuery.data);
  }, [editingDomainsQuery.data]);

  const normalizedDefaultProjectState = useMemo(() => {
    return filterOptions ? getDefaultProjectState(filterOptions.projectStatus) : new Set<Key>();
  }, [filterOptions]);

  const normalizedDefaultFeatureState = useMemo(() => {
    return filterOptions ? getDefaultFeatureState(filterOptions.featureTypes) : new Set<Key>();
  }, [filterOptions]);

  useEffect(() => {
    if (projectId > 0 || !filterOptions || initializedFilters.current) {
      return;
    }

    initializedFilters.current = true;
    dispatch({
      type: 'reset',
      payload: {
        projects: new Set(normalizedDefaultProjectState),
        features: new Set(normalizedDefaultFeatureState),
        join: defaultJoin,
      },
    });
  }, [dispatch, filterOptions, normalizedDefaultFeatureState, normalizedDefaultProjectState, projectId]);

  const filtersLoading = editingDomainsQuery.isPending;
  const filtersError = editingDomainsQuery.isError
    ? editingDomainsQuery.error instanceof Error
      ? editingDomainsQuery.error.message
      : 'Failed to load filter options.'
    : null;

  if (projectId > 0) {
    setDefinitionExpression(featureLayers, {
      centroids: `1=0`,
      point: `Project_ID!=${projectId}`,
      line: `Project_ID!=${projectId}`,
      poly: `Project_ID!=${projectId}`,
    });
  } else if (filterOptions && initializedFilters.current) {
    const expressions = generateDefinitionExpression(state, filterOptions);
    setDefinitionExpression(featureLayers, expressions);
  }

  return (
    <FilterContext.Provider
      value={{
        selectedFeatures: state.features,
        selectedProjects: state.projects,
        dispatch,
        featureLayers,
        defaultFeatureState: normalizedDefaultFeatureState,
        defaultProjectState: normalizedDefaultProjectState,
        projectStatus: filterOptions?.projectStatus ?? [],
        featureTypes: filterOptions?.featureTypes ?? [],
        filtersLoading,
        filtersError,
        wriFunding: state.wriFunding,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};
