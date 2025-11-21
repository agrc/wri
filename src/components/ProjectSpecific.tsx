import Collection from '@arcgis/core/core/Collection';
import { useQuery } from '@tanstack/react-query';
import { Switch, Tab, TabList, TabPanel, Tabs, useFirebaseFunctions } from '@ugrc/utah-design-system';
import { httpsCallable } from 'firebase/functions';
import { DiamondIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Group } from 'react-aria-components';
import { List } from 'react-content-loader';
import { ErrorBoundary } from 'react-error-boundary';
import {
  AdjacentProjects,
  OpacityManager,
  ProjectStatusTag,
  ReferenceData,
  ReferenceLabelSwitch,
  TagGroupLoader,
  titleCase,
  type ReferenceLayer,
} from './';
import { ErrorFallback } from './ErrorFallBack';
import { useMap } from './hooks';
import { useHighlight } from './hooks/useHighlight';
import ProjectFeaturesList from './ProjectFeaturesList';

export type ProjectResponse = {
  id: number;
  manager: string;
  agency: string;
  title: string;
  status: string;
  description: string;
  region: string;
  affected: string;
  terrestrial: string;
  aquatic: string;
  easement: string;
  stream: string;
  county: CountyIntersection[];
  owner: LandOwnerIntersection[];
  sgma: SageGrouseIntersection[];
  polygons: PolygonFeatures;
  lines: Feature[];
  points: Feature[];
};

export type CountyIntersection = { county: string; area: string };

export type LandOwnerIntersection = { owner: string; admin: string; area: string };

export type SageGrouseIntersection = { name: string; area: string };

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
  herbicide: string | nullish;
  retreatment: 'Y' | 'N' | nullish;
};

export type FeatureLayerId = 'feature-point' | 'feature-line' | 'feature-poly';

export const ProjectSpecificView = ({ projectId }: { projectId: number }) => {
  const tabRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<boolean>(true);
  const { mapView, currentMapScale } = useMap();
  const { highlight, clear } = useHighlight(mapView);
  const { functions } = useFirebaseFunctions();
  functions.region = 'us-west3';
  const getProjectInfo = httpsCallable(functions, 'project');

  const allLayers = mapView?.map?.layers ?? new Collection();
  const referenceLayers = allLayers.filter((layer) => layer.id.startsWith('reference')) as Collection<ReferenceLayer>;

  const { data, status } = useQuery<ProjectResponse>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const result = await getProjectInfo({ id: projectId });

      return result.data as ProjectResponse;
    },
  });

  return (
    <div className="mx-2 mb-2 grid grid-cols-1 gap-2 dark:text-zinc-100">
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
                onSelectionChange={(key) => {
                  console.log(key);
                  setTimeout(
                    () =>
                      tabRef.current
                        ?.querySelector('[role="tab"][aria-selected="true"]')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
                    0,
                  );
                }}
              >
                <div className="overflow-x-auto overflow-y-hidden pb-4 pt-1">
                  <TabList aria-label="Project details">
                    <Tab id="details">Details</Tab>
                    <Tab id="features">Features</Tab>
                    <Tab id="reference">Reference</Tab>
                  </TabList>
                </div>
                <TabPanel id="details">
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
                    {(data.affected?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Affected acres</p>
                        <p>{data.affected}</p>
                      </div>
                    )}
                    {(data.terrestrial?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Terrestrial acres</p>
                        <p>{data.terrestrial}</p>
                      </div>
                    )}
                    {(data.aquatic?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Aquatic and riparian acres</p>
                        <p>{data.aquatic}</p>
                      </div>
                    )}
                    {(data.easement?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Easement and acquisition acres</p>
                        <p>{data.easement}</p>
                      </div>
                    )}
                    {(data.stream?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold [&>p:last-child]:pl-3">
                        <p>Stream miles</p>
                        <p>{data.stream}</p>
                      </div>
                    )}
                    {(data.county?.length ?? 0) > 0 && (
                      <div className="[&>p:first-child]:font-bold">
                        <p>County</p>
                        <ul className="pl-3">
                          {data.county.map((x: Record<string, string>) => (
                            <li key={x.county}>
                              {titleCase(x.county)} - {x.area}
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
                              {x.owner}, {x.admin} - {x.area}
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
                            <li key={x.sgma}>
                              {x.sgma} - {x.area}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Group>
                </TabPanel>
                <TabPanel shouldForceMount id="features" className="px-0 data-[inert]:hidden">
                  <Switch aria-label="Zoom to selection" isSelected={selected} onChange={setSelected}>
                    Zoom to selection
                  </Switch>
                  <ProjectFeaturesList
                    projectId={projectId}
                    polygons={data.polygons ?? {}}
                    lines={data.lines ?? []}
                    points={data.points ?? []}
                    onSelect={(details) => {
                      const isActive = highlight(details, { enabled: selected, extentScale: 1.1 });
                      if (isActive === false) {
                        clear();
                      }

                      return isActive;
                    }}
                    onClear={() => clear()}
                    renderOpacity={(layerId, oid) => {
                      const layer = mapView?.map?.findLayerById(layerId) as __esri.FeatureLayer | undefined | null;
                      if (!mapView?.ready || !layer) return null;

                      return <OpacityManager layer={layer as __esri.FeatureLayer} oid={oid} />;
                    }}
                  />
                </TabPanel>
                <TabPanel shouldForceMount id="reference" className="flex flex-col gap-2 data-[inert]:hidden">
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
