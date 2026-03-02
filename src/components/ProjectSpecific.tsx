import Collection from '@arcgis/core/core/Collection';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Switch, Tab, TabList, TabPanel, Tabs, useFirebaseFunctions } from '@ugrc/utah-design-system';
import { httpsCallable } from 'firebase/functions';
import { DiamondIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Group } from 'react-aria-components';
import { List } from 'react-content-loader';
import { ErrorBoundary } from 'react-error-boundary';
import type { FeatureKind } from '../types';
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
import { FeatureSelectionProvider, useFeatureSelection } from './contexts';
import { ErrorFallback } from './ErrorFallBack';
import { useMap } from './hooks';
import { useHighlight } from './hooks/useHighlight';
import ProjectFeaturesList from './ProjectFeaturesList';

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
export type FeatureDetailsContract = Pick<Feature, 'id' | 'type'>;
export type PolygonFeature = Feature & {
  herbicide: string | nullish;
  retreatment: 'Y' | 'N' | nullish;
};

export type FeatureLayerId = 'feature-point' | 'feature-line' | 'feature-poly';

const ProjectSpecificContent = ({ projectId }: { projectId: number }) => {
  const tabRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<boolean>(true);
  const [selectedTab, setSelectedTab] = useState<string>('project');
  const [featureDetails, setFeatureDetails] = useState<FeatureDetailsContract | null>(null);
  const [featureError, setFeatureError] = useState<string | null>(null);
  const [updateStatsError, setUpdateStatsError] = useState<string | null>(null);
  const { mapView, currentMapScale } = useMap();
  const { highlight, clear } = useHighlight(mapView);
  const { selectedFeature } = useFeatureSelection();
  const { functions } = useFirebaseFunctions();
  functions.region = 'us-west3';

  const getProjectInfo = httpsCallable(functions, 'project');
  const getFeatureInfo = httpsCallable(functions, 'feature');
  const deleteFeatureFn = httpsCallable(functions, 'deleteFeature');

  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      const layerId = `project-${projectId}-feature-${variables.featureKind}`;
      const layer = mapView?.map?.findLayerById(layerId) as __esri.FeatureLayer | undefined | null;
      if (!layer) return;

      layer
        .queryFeatures({ where: `FeatureID=${variables.featureId}`, returnGeometry: false })
        .then((results) => layer.applyEdits({ deleteFeatures: results.features }))
        .catch((error) => console.error('Failed to remove feature from map layer:', error));
    },
    onError: (error) => setFeatureError(error.message ?? 'Failed to delete feature'),
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

  const { data: featureData, status: featureStatus } = useQuery<FeatureIntersections>({
    queryKey: ['featureDetails', projectId, featureDetails],
    queryFn: async () => {
      const result = await getFeatureInfo({ type: featureDetails?.type, featureId: featureDetails?.id });

      return result.data as FeatureIntersections;
    },
    enabled: featureDetails !== null,
  });

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
                  </Group>
                </TabPanel>
                <TabPanel shouldForceMount id="features" className="p-0 data-[inert]:hidden">
                  <div className="grid grid-cols-1 items-center gap-2">
                    {deleteMutation.isPending ? (
                      <List className="w-96" />
                    ) : (
                      <>
                        {data.allowEdits && (
                          <Button
                            variant="secondary"
                            className="w-full"
                            onPress={() => alert('Feature adding not yet implemented')}
                          >
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
                          featureError={featureError}
                          onDismissFeatureError={() => setFeatureError(null)}
                          onDelete={(featureId, featureType, featureKind) =>
                            deleteMutation.mutate({ featureId, featureType, featureKind })
                          }
                          onSelect={(details) => {
                            setFeatureDetails(details);

                            const isActive = highlight(details, { enabled: selected, extentScale: 1.1 });
                            if (isActive === false) {
                              clear();
                            }

                            return isActive;
                          }}
                          onClear={() => {
                            clear();
                            setFeatureDetails(null);
                          }}
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
  return (
    <FeatureSelectionProvider>
      <ProjectSpecificContent projectId={projectId} />
    </FeatureSelectionProvider>
  );
};
