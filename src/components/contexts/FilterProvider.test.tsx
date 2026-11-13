import Collection from '@arcgis/core/core/Collection';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import type { EditingDomainsResponse } from '@ugrc/wri-shared/types';
import type { EffectCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultProjectState, normalizeFilterOptions } from '../data/filters';
import { ProjectStatus } from '../ProjectStatus';
import { FilterContext } from './FilterContext';
import { FilterProvider } from './FilterProvider';
import { ProjectContext } from './ProjectContext';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  effects: [] as EffectCallback[],
  useEffect: vi.fn(),
  useEditingDomains: vi.fn(),
  useImmerReducer: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: mocks.useEffect,
}));

vi.mock('use-immer', () => ({ useImmerReducer: mocks.useImmerReducer }));
vi.mock('../../hooks/useEditingDomains', () => ({ useEditingDomains: mocks.useEditingDomains }));
vi.mock('.', async () => ({
  ...(await import('./FilterContext')),
  ...(await import('./ProjectContext')),
}));

const domains: EditingDomainsResponse = {
  projectStatuses: [
    { code: 1, value: 'Draft' },
    { code: 3, value: 'Current' },
    { code: 5, value: 'Completed' },
  ],
  featureTypes: { Fence: 'LINE' },
  featureAttributes: {},
  affectedAreaActions: [],
  herbicides: [],
  pointLineActions: [],
};
const filterOptions = normalizeFilterOptions(domains);

describe('FilterProvider project status synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.effects.length = 0;
    mocks.useEffect.mockImplementation((effect: EffectCallback) => {
      mocks.effects.push(effect);
    });
    mocks.useEditingDomains.mockReturnValue({ data: domains, isPending: false, isError: false });
    mocks.useImmerReducer.mockReturnValue([
      { projects: new Set(), features: new Set(), join: 'or', wriFunding: false },
      mocks.dispatch,
    ]);
  });

  it.each([null, 42])('initializes defaults when first opening project %s', (projectId) => {
    renderToStaticMarkup(
      <ProjectContext.Provider value={{ projectId, setProjectId: vi.fn() }}>
        <FilterProvider featureLayers={new Collection()}>{null}</FilterProvider>
      </ProjectContext.Provider>,
    );
    mocks.effects.forEach((effect) => effect());

    expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith({
      type: 'reset',
      payload: {
        projects: getDefaultProjectState(filterOptions.projectStatus),
        features: new Set(['Fence']),
        join: 'or',
      },
    });
  });

  it('uses the same controlled selection and active styles in both status controls', () => {
    const markup = renderToStaticMarkup(
      <FilterContext.Provider
        value={{
          featureLayers: new Collection(),
          dispatch: mocks.dispatch,
          defaultProjectState: getDefaultProjectState(filterOptions.projectStatus),
          defaultFeatureState: new Set(['Fence']),
          selectedProjects: new Set(['Current']),
          selectedFeatures: new Set(['Fence']),
          projectStatus: filterOptions.projectStatus,
          featureTypes: filterOptions.featureTypes,
          filtersLoading: false,
          filtersError: null,
          wriFunding: false,
        }}
      >
        <ProjectStatus status={filterOptions.projectStatus} />
        <ProjectStatus status={filterOptions.projectStatus} />
      </FilterContext.Provider>,
    );

    expect(markup.match(/aria-selected="true"/g)).toHaveLength(2);
    expect(markup.match(/data-selected="true"/g)).toHaveLength(2);
    expect(markup.match(/selected:bg-sky-600/g)).toHaveLength(2);
    expect(markup.match(/aria-selected="false"/g)).toHaveLength(4);
  });

  it('applies shared status changes to adjacent layers without general-map feature or funding filters', () => {
    mocks.useEffect.mockImplementation((effect: EffectCallback) => effect());
    const layers = new Collection(
      ['centroids', 'point', 'line', 'poly'].map((kind) => new FeatureLayer({ id: `feature-${kind}` })),
    );
    const render = (projects: Set<string>) => {
      mocks.useImmerReducer.mockReturnValue([
        { projects, features: new Set(), join: 'and', wriFunding: true },
        mocks.dispatch,
      ]);
      renderToStaticMarkup(
        <ProjectContext.Provider value={{ projectId: 42, setProjectId: vi.fn() }}>
          <FilterProvider featureLayers={layers}>{null}</FilterProvider>
        </ProjectContext.Provider>,
      );
    };

    render(new Set(['Current']));

    expect(layers.map((layer) => layer.definitionExpression).toArray()).toEqual([
      '1=0',
      "StatusDescription in('Current') and Project_ID!=42",
      "StatusDescription in('Current') and Project_ID!=42",
      "StatusDescription in('Current') and Project_ID!=42",
    ]);

    render(new Set());

    expect(layers.map((layer) => layer.definitionExpression).toArray()).toEqual(['1=0', '1=0', '1=0', '1=0']);
    layers.forEach((layer) => layer.destroy());
  });
});
