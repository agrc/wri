import Collection from '@arcgis/core/core/Collection';
import { fromJSON } from '@arcgis/core/geometry/support/jsonUtils';
import Graphic from '@arcgis/core/Graphic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Switch, Tab, TabList, TabPanel, Tabs, useFirebaseFunctions } from '@ugrc/utah-design-system';
import { httpsCallable } from 'firebase/functions';
import { DiamondIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Group } from 'react-aria-components';
import { List } from 'react-content-loader';
import { ErrorBoundary } from 'react-error-boundary';
import { useEditingDomains } from '../hooks/useEditingDomains';
import { POLY_OPACITY } from '../mapLayers';
import type { CreateFeatureData, FeatureKind } from '../types';
import { getUserCredentials } from '../utils/userCredentials';
import {
  AdjacentProjects,
  DownloadProjectData,
  OpacityManager,
  ProjectStatusTag,
  ReferenceData,
  ReferenceLabelSwitch,
  TagGroupLoader,
  titleCase,
  type ReferenceLayer,
} from './';
import AddFeatureForm from './AddFeatureForm';
import { useFeatureSelection } from './contexts';
import { ErrorFallback } from './ErrorFallBack';
import { getProjectFeatureLayerId, resolveSelectedFeature, type FeatureSelectionIdentity } from './featureSelection';
import { useMap } from './hooks';
import { useHighlight } from './hooks/useHighlight';
import ProjectFeaturesList from './ProjectFeaturesList';
import { UpdateProjectStatistics } from './UpdateProjectStatistics';

export type Project = {
  id: number;
  manager: string;
  agency: string;
  title: string;
  status: string;
  description: string;
  region: string;
  affected: number;
  terrestrial: number;
  aquatic: number;
  easement: number;
  stream: number;
};
export type ProjectFeatures = {
  polygons: PolygonFeatures;
  lines: Feature[];
  points: Feature[];
};
export type ProjectResponse = {
  allowEdits: boolean;
  county: FeatureIntersection[];
  owner: LandOwnerIntersection[];
  sgma: FeatureIntersection[];
} & Project &
  ProjectFeatures;
export type FeatureIntersections = {
  county: FeatureIntersection[];
  owner: LandOwnerIntersection[];
  sgma: FeatureIntersection[];
  stream: FeatureIntersection[];
};
export type FeatureIntersection = { name: string; area: string };
export type LandOwnerIntersection = { owner: string; admin: string; area: string };
export type PolygonFeatures = { [key: string]: PolygonFeature[] };
export type Feature = {
  id: number;
  type: string;
  subtype: string | nullish;
  action: string | nullish;
  description: string | nullish;
  size: string;
  layer: FeatureLayerId;
};
export type PolygonFeature = Feature & {
  herbicides: string[];
  retreatment: boolean | nullish;
};

export type FeatureLayerId = 'feature-point' | 'feature-line' | 'feature-poly';

const ProjectSpecificContent = ({ projectId }: { projectId: number }) => {
  const tabRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<boolean>(true);
  const [selectedTab, setSelectedTab] = useState<string>('project');
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [projectLayerVersion, setProjectLayerVersion] = useState(0);
  const { mapView, currentMapScale } = useMap();
  const { highlight, clear } = useHighlight(mapView);
  const {
    clearSelection,
    registerResolver,
    selectedFeature,
    selectedFeatureIdentity,
    selectionOrigin,
    setMapSelectionEnabled,
  } = useFeatureSelection();
  const zoomSelectionRef = useRef(selected);
  const { functions } = useFirebaseFunctions();
  functions.region = 'us-west3';

  const getProjectInfo = httpsCallable(functions, 'project');
  const getFeatureInfo = httpsCallable(functions, 'feature');
  const deleteFeatureFn = httpsCallable(functions, 'deleteFeature');
  const createFeatureFn = httpsCallable(functions, 'createFeature');

  const queryClient = useQueryClient();

  const logDeleteFeatureResult = (results: __esri.EditsResult, featureId: number) => {
    const deleteResult = results.deleteFeatureResults?.[0];

    if (!deleteResult) {
      console.error(
        'Failed to remove feature from map layer:',
        new Error('No deleteFeatureResults returned from applyEdits'),
      );
      return;
    }

    if ('error' in deleteResult && deleteResult.error) {
      console.error('Failed to remove feature from map layer:', deleteResult.error);
      return;
    }

    console.log(`Feature removed from map layer: ${featureId}`);
  };

  const deleteMutation = useMutation({
    mutationFn: async ({
      featureId,
      featureType,
    }: {
      featureId: number;
      featureType: string;
      featureKind: FeatureKind;
    }) => {
      const credentials = getUserCredentials();
      await deleteFeatureFn({ projectId, featureId, featureType, ...credentials });
    },
    onSuccess: (_data, variables) => {
      setFeatureError(null);
      if (selectedFeatureIdentity?.projectId === projectId && selectedFeatureIdentity.id === variables.featureId) {
        clearSelection();
      }
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      const layer = getFeatureLayer(variables.featureKind);
      if (!layer) return;

      layer
        .queryFeatures({ where: `FeatureID=${variables.featureId}`, returnGeometry: false })
        .then((results) => layer.applyEdits({ deleteFeatures: results.features }))
        .then((results) => logDeleteFeatureResult(results, variables.featureId))
        .catch((error) => console.error('Failed to remove feature from map layer:', error));
    },
    onError: (error) => setFeatureError(error.message ?? 'Failed to delete feature'),
  });

  const getFeatureLayer = (kind: FeatureKind) =>
    mapView?.map?.findLayerById(`project-${projectId}-feature-${kind}`) as __esri.FeatureLayer | undefined | null;

  const logAddFeatureResult = (results: __esri.EditsResult, featureId: number) => {
    console.log('Add feature results from applyEdits:', results);
    const addResult = results.addFeatureResults?.[0];

    if (!addResult) {
      console.error('Failed to add feature to map layer:', new Error('No addFeatureResults returned from applyEdits'));
      return;
    }

    if ('error' in addResult && addResult.error) {
      console.error('Failed to add feature to map layer:', addResult.error);
      return;
    }

    console.log(`Feature added to map layer: ${featureId}`);
  };

  const createMutation = useMutation({
    mutationFn: async (formData: CreateFeatureData) => {
      setCreateError(null);
      const credentials = getUserCredentials();
      const result = await createFeatureFn({ ...formData, ...credentials });
      return result.data as { message: string; featureId: number; statusDescription: string | null };
    },
    onSuccess: (_data, variables) => {
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      const featureTable = editingDomainsQuery.data?.featureTypes[variables.featureType];

      if (!featureTable) {
        const errorMessage = `Unable to determine map layer for feature type "${variables.featureType}".`;
        console.error(errorMessage, {
          featureType: variables.featureType,
          featureId: _data.featureId,
        });
        setCreateError(errorMessage);
        return;
      }

      const kind: FeatureKind = featureTable.toLowerCase() as FeatureKind;
      const layer = getFeatureLayer(kind);

      if (layer) {
        const geom = fromJSON(variables.geometry);
        const graphic = new Graphic({
          geometry: geom,
          attributes: {
            FeatureID: _data.featureId,
            Project_ID: variables.projectId,
            TypeDescription: variables.featureType,
            StatusDescription: _data.statusDescription,
            Title: null,
            _opacity: kind === 'poly' ? POLY_OPACITY : 1,
          },
        });
        layer
          .applyEdits({ addFeatures: [graphic] })
          .then((results) => logAddFeatureResult(results, _data.featureId))
          .catch((error) => console.error('Failed to add feature to map layer:', error));
      }
    },
    onError: (error) => setCreateError(error.message ?? 'Failed to create feature'),
  });

  const allLayers = mapView?.map?.layers ?? new Collection();
  const referenceLayers = allLayers.filter((layer) => layer.id.startsWith('reference')) as Collection<ReferenceLayer>;

  const { data, status } = useQuery<ProjectResponse>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const credentials = getUserCredentials();
      const result = await getProjectInfo({ id: projectId, ...credentials });

      return result.data as ProjectResponse;
    },
    enabled: projectId > 0,
  });

  const editingDomainsQuery = useEditingDomains(data?.allowEdits ?? false);

  const { data: featureData, status: featureStatus } = useQuery<FeatureIntersections>({
    queryKey: ['featureDetails', projectId, selectedFeature?.id ?? null, selectedFeature?.type ?? null],
    queryFn: async () => {
      const result = await getFeatureInfo({
        type: selectedFeature?.type.toLowerCase(),
        featureId: selectedFeature?.id,
      });

      return result.data as FeatureIntersections;
    },
    enabled: selectedFeature !== null,
  });

  const resolveProjectSelection = useCallback(
    (selection: FeatureSelectionIdentity) => {
      if (status !== 'success' || selection.projectId !== projectId) {
        return null;
      }

      return resolveSelectedFeature({
        kind: selection.kind,
        id: selection.id,
        polygons: data.polygons ?? {},
        lines: data.lines ?? [],
        points: data.points ?? [],
      });
    },
    [data, projectId, status],
  );

  useEffect(() => {
    zoomSelectionRef.current = selected;
  }, [selected]);

  useEffect(() => {
    registerResolver(status === 'success' ? resolveProjectSelection : null);

    return () => {
      registerResolver(null);
    };
  }, [registerResolver, resolveProjectSelection, status]);

  useEffect(() => {
    setMapSelectionEnabled(!isCreating);
  }, [isCreating, setMapSelectionEnabled]);

  useEffect(() => {
    clearSelection();
  }, [clearSelection, projectId]);

  useEffect(() => {
    if (!mapView?.map) {
      return;
    }

    const handle = mapView.map.layers.on('change', (event) => {
      const changedProjectLayers = [...event.added, ...event.removed].some((layer) =>
        layer.id.startsWith(`project-${projectId}-feature-`),
      );

      if (changedProjectLayers) {
        setProjectLayerVersion((version) => version + 1);
      }
    });

    return () => {
      handle.remove();
    };
  }, [mapView, projectId]);

  useEffect(() => {
    if (!selectedFeatureIdentity || selectedFeatureIdentity.projectId !== projectId || status !== 'success') {
      return;
    }

    if (!resolveProjectSelection(selectedFeatureIdentity)) {
      clearSelection();
    }
  }, [clearSelection, projectId, resolveProjectSelection, selectedFeatureIdentity, status]);

  useEffect(() => {
    if (selectedFeatureIdentity?.projectId === projectId && selectionOrigin === 'map') {
      setSelectedTab('features');
    }
  }, [projectId, selectedFeatureIdentity, selectionOrigin]);

  useEffect(() => {
    if (!selectedFeature) {
      clear();

      return;
    }

    highlight(
      {
        layer: getProjectFeatureLayerId(projectId, selectedFeature.kind),
        id: selectedFeature.id,
      },
      { enabled: zoomSelectionRef.current, extentScale: 1.1 },
    );
  }, [clear, highlight, projectId, projectLayerVersion, selectedFeature, selectedFeatureIdentity]);

  return (
    <div className="mx-2 mb-2 grid grid-cols-1 gap-1 dark:text-zinc-100">
      <h2 className="text-xl font-bold">Project {projectId}</h2>
      <div className="flex flex-col gap-0 rounded border border-zinc-200 px-2 py-3 dark:border-zinc-700" ref={tabRef}>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {status === 'pending' && <List className="w-96" />}
          {status === 'success' && (
            <>
              <div className="flex justify-between">
                <p>
                  <a href={`/wri/project/title.html?id=${projectId}`}>{data.title}</a>
                </p>
                <ProjectStatusTag status={data.status} />
              </div>
              <div className="mb-0 mt-2 flex justify-center">
                <div className="mx-2 w-6">
                  <DiamondIcon className="size-2 fill-primary-400/50 text-primary-600" />
                </div>
                <div className="mx-2 w-6">
                  <DiamondIcon className="size-2 fill-accent-500/50 text-accent-700" />
                </div>
                <div className="mx-2 w-6">
                  <DiamondIcon className="size-2 fill-primary-400/50 text-primary-600" />
                </div>
              </div>
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => {
                  setSelectedTab(key as string);
                  setTimeout(
                    () =>
                      tabRef.current
                        ?.querySelector('[role="tab"][aria-selected="true"]')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
                    0,
                  );
                }}
                className="gap-0"
              >
                <div className="overflow-x-auto overflow-y-hidden pb-4 pt-1">
                  <TabList aria-label="Project details">
                    <Tab id="project" aria-label="Project details">
                      Project
                    </Tab>
                    <Tab id="features" aria-label="Features within the project">
                      Features
                    </Tab>
                    <Tab id="featureDetails" aria-label="Details of a selected feature">
                      Details
                    </Tab>
                    <Tab id="reference" aria-label="Reference data controls">
                      Reference
                    </Tab>
                  </TabList>
                </div>
                <TabPanel className="p-0" id="project">
                  <Group className="flex flex-col gap-y-1 dark:text-zinc-100">
                    <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                      <p>Description</p>
                      <p>{data.description}</p>
                    </div>
                    <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                      <p>Project manager</p>
                      <p>{data.manager}</p>
                    </div>
                    <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                      <p>Lead agency</p>
                      <p>{data.agency}</p>
                    </div>
                    <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                      <p>Region</p>
                      <p>{data.region}</p>
                    </div>
                    {data.affected && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Affected</p>
                        <p>{data.affected}</p>
                      </div>
                    )}
                    {data.terrestrial && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Terrestrial</p>
                        <p>{data.terrestrial}</p>
                      </div>
                    )}
                    {data.aquatic && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Aquatic and riparian</p>
                        <p>{data.aquatic}</p>
                      </div>
                    )}
                    {data.easement && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Easement and acquisition</p>
                        <p>{data.easement}</p>
                      </div>
                    )}
                    {data.stream && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Stream</p>
                        <p>{data.stream}</p>
                      </div>
                    )}
                    {(data.county?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold">
                        <p>County</p>
                        <ul className="pl-3">
                          {data.county.map((x: Record<string, string>) => (
                            <li key={x.name}>
                              {titleCase(x.name)} ({x.area})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(data.owner?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Land ownership</p>
                        <ul className="pl-3">
                          {data.owner.map((x: Record<string, string>) => (
                            <li key={`${x.owner}${x.admin}`}>
                              {x.owner}, {x.admin} ({x.area})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(data.sgma?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Sage grouse</p>
                        <ul className="pl-3">
                          {data.sgma.map((x: Record<string, string>) => (
                            <li key={x.name}>
                              {x.name} ({x.area})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <DownloadProjectData projectId={projectId} />
                    <UpdateProjectStatistics projectId={projectId} allowEdits={data.allowEdits} />
                  </Group>
                </TabPanel>
                <TabPanel shouldForceMount id="features" className="p-0 data-[inert]:hidden">
                  {isCreating ? (
                    <AddFeatureForm
                      projectId={projectId}
                      domains={editingDomainsQuery.data}
                      isSaving={createMutation.isPending}
                      saveError={createError}
                      onCancel={() => {
                        setCreateError(null);
                        setIsCreating(false);
                      }}
                      onSave={(formData) => createMutation.mutate(formData)}
                    />
                  ) : (
                    <div className="grid grid-cols-1 items-center gap-2">
                      {deleteMutation.isPending ? (
                        <List className="w-96" />
                      ) : (
                        <>
                          {data.allowEdits && (
                            <Button variant="secondary" className="w-full" onPress={() => setIsCreating(true)}>
                              Add Feature
                            </Button>
                          )}
                          <Switch aria-label="Zoom to selection" isSelected={selected} onChange={setSelected}>
                            Zoom to selection
                          </Switch>
                          <ProjectFeaturesList
                            projectId={projectId}
                            allowEdits={data.allowEdits}
                            polygons={data.polygons ?? {}}
                            lines={data.lines ?? []}
                            points={data.points ?? []}
                            isVisible={selectedTab === 'features'}
                            featureError={featureError}
                            onDismissFeatureError={() => setFeatureError(null)}
                            onDelete={(featureId, featureType, featureKind) =>
                              deleteMutation.mutate({ featureId, featureType, featureKind })
                            }
                            onViewDetails={() => setSelectedTab('featureDetails')}
                            renderOpacity={(layerId, oid) => {
                              const layer = mapView?.map?.findLayerById(layerId) as
                                | __esri.FeatureLayer
                                | undefined
                                | null;
                              if (!mapView?.ready || !layer) return null;

                              return <OpacityManager layer={layer as __esri.FeatureLayer} oid={oid} />;
                            }}
                          />
                        </>
                      )}
                    </div>
                  )}
                </TabPanel>
                <TabPanel shouldForceMount id="featureDetails" className="p-0 data-[inert]:hidden">
                  {deleteMutation.isPending ? (
                    <List className="w-96" />
                  ) : !selectedFeature ? (
                    <>Select a feature to view details</>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <p className="font-bold">{selectedFeature.type}</p>
                        {selectedFeature.size && (
                          <span
                            className="flex-none self-start whitespace-nowrap rounded border px-1 py-0.5 text-xs dark:border-zinc-600"
                            aria-label="Feature size"
                          >
                            {selectedFeature.size}
                          </span>
                        )}
                      </div>
                      {selectedFeature.isRetreatment && (
                        <div className="mb-2 rounded bg-amber-50 px-2 py-1 text-sm dark:bg-amber-900/20">
                          <span className="font-semibold">Retreatment</span>
                        </div>
                      )}
                      {selectedFeature.details && selectedFeature.details.length > 0 && (
                        <div className="mb-2">
                          <ol className="list-inside list-decimal space-y-1">
                            {selectedFeature.details.map((line, idx) => (
                              <li key={`${selectedFeature.id}-detail-${idx}`} className="text-sm">
                                {line}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {featureStatus === 'pending' && <List className="w-96" />}
                      {featureStatus === 'success' && featureData && (
                        <Group className="flex flex-col gap-y-1 dark:text-zinc-100">
                          {(featureData.stream?.length ?? 0) > 0 && (
                            <div className="[&>p:first-child]:font-bold">
                              <p>Stream miles</p>
                              <ul className="pl-3">
                                {featureData.stream.map((x: Record<string, string>, i) => (
                                  <li key={`${i}-${x.name}`}>
                                    {titleCase(x.name)} ({x.area})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(featureData.county?.length ?? 0) > 0 && (
                            <div className="[&>p:first-child]:font-bold">
                              <p>County</p>
                              <ul className="pl-3">
                                {featureData.county.map((x: Record<string, string>, i) => (
                                  <li key={`${i}-${x.name}`}>
                                    {titleCase(x.name)} ({x.area})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(featureData.owner?.length ?? 0) > 0 && (
                            <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                              <p>Land ownership</p>
                              <ul className="pl-3">
                                {featureData.owner.map((x: Record<string, string>) => (
                                  <li key={`${x.owner}${x.admin}`}>
                                    {x.owner}, {x.admin} ({x.area})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(featureData.sgma?.length ?? 0) > 0 && (
                            <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                              <p>Sage grouse</p>
                              <ul className="pl-3">
                                {featureData.sgma.map((x: Record<string, string>) => (
                                  <li key={x.name}>
                                    {x.name} ({x.area})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </Group>
                      )}
                    </>
                  )}
                </TabPanel>
                <TabPanel shouldForceMount id="reference" className="flex flex-col gap-2 p-0 data-[inert]:hidden">
                  <AdjacentProjects mapView={mapView} />
                  {referenceLayers.length > 0 ? (
                    <div>
                      <ReferenceData layers={referenceLayers} currentMapScale={currentMapScale ?? 0} />
                      <ReferenceLabelSwitch layers={referenceLayers}>Labels</ReferenceLabelSwitch>
                    </div>
                  ) : (
                    <TagGroupLoader />
                  )}
                </TabPanel>
              </Tabs>
            </>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
};

export const ProjectSpecificView = ({ projectId }: { projectId: number }) => {
  return <ProjectSpecificContent projectId={projectId} />;
};
