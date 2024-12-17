import Collection from '@arcgis/core/core/Collection';
import { useQuery } from '@tanstack/react-query';
import { Tab, TabList, TabPanel, Tabs } from '@ugrc/utah-design-system';
import ky from 'ky';
import { Group } from 'react-aria-components';
import { List } from 'react-content-loader';
import { ErrorBoundary } from 'react-error-boundary';
import { Fragment } from 'react/jsx-runtime';
import {
  ProjectStatusTag,
  ReferenceData,
  ReferenceLabelSwitch,
  type ReferenceLayer,
  TagGroupLoader,
  titleCase,
} from './';
import { ErrorFallback } from './ErrorFallBack';
import { useMap } from './hooks';

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
  polygons: Polygons;
  lines: Line[];
  points: Point[];
};

export type CountyIntersection = {
  county: string;
  area: string;
};

export type LandOwnerIntersection = {
  owner: string;
  admin: string;
  area: string;
};

export type SageGrouseIntersection = {
  name: string;
  area: string;
};

export type Polygons = {
  [key: string]: Polygon[];
};

export type Polygon = {
  id: number;
  type: string;
  subtype: string;
  action: string;
  herbicide: string;
  retreatment: string;
  layer: FeatureLayerId;
  size: string;
};

export type Line = {
  id: number;
  type: string;
  subtype: string;
  action: string;
  layer: FeatureLayerId;
  length: string;
};

export type Point = {
  id: number;
  type: string;
  subtype: string;
  description: string;
  layer: FeatureLayerId;
  count: string;
};

export type FeatureLayerId = 'feature-point' | 'feature-line' | 'feature-poly';

export const ProjectSpecificView = ({ projectId }: { projectId: number }) => {
  const { mapView, currentMapScale } = useMap();

  const allLayers = mapView?.map?.layers ?? new Collection();
  const referenceLayers = allLayers.filter((layer) => layer.id.startsWith('reference')) as Collection<ReferenceLayer>;

  const { data, status } = useQuery<ProjectResponse>({
    queryKey: ['project', projectId],
    queryFn: async () =>
      await ky
        .get(`http://127.0.0.1:5001/ut-dts-agrc-wri-dev/us-central1/project?id=${projectId}`, {
          retry: 1,
        })
        .json(),
  });

  return (
    <div className="mx-2 mb-2 grid grid-cols-1 gap-2 dark:text-zinc-100">
      <h2 className="text-xl font-bold">Project {projectId}</h2>
      <div className="flex flex-col gap-0 rounded border border-zinc-200 px-2 py-3 dark:border-zinc-700">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {status === 'pending' && <List className="w-96" />}
          {status === 'success' && (
            <>
              <div className="flex justify-between">
                <p>
                  <a href={`./project/title.html?id=${projectId}`}>{data.title}</a>
                </p>
                <ProjectStatusTag status={data.status} />
              </div>
              <div className="mb-2 mt-4 flex h-px justify-center">
                <div className="mx-2 w-6 bg-zinc-200" />
                <div className="mx-2 w-6 bg-zinc-300" />
                <div className="mx-2 w-6 bg-zinc-200" />
              </div>
              <Tabs onSelectionChange={(key) => console.log(key)}>
                <div className="overflow-x-auto overflow-y-hidden pb-4">
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
                <TabPanel id="features">
                  <Group className="flex flex-col gap-y-2 dark:text-zinc-100 [&>hr:last-child]:hidden">
                    {Object.keys(data.polygons ?? {}).length > 0 &&
                      Object.values(data.polygons).map((x, i) => (
                        <Fragment key={`${i}-${x[0]?.type}`}>
                          <div>
                            <div className="flex justify-between">
                              <p className="font-bold">{x[0]?.type}</p>
                              <p className="flex-none self-start whitespace-nowrap rounded border px-1 py-0.5 text-xs dark:border-zinc-600">
                                {x[0]?.size}
                              </p>
                            </div>
                            <p>Retreatment - {x[0]?.retreatment}</p>
                            <ol className="list-inside list-decimal pl-3">
                              {x.map((y) => (
                                <li key={`${y.action}-${y.subtype}`}>
                                  {y.action} - {y.subtype} {y.herbicide && `- ${y.herbicide}`}
                                </li>
                              ))}
                            </ol>
                          </div>
                          {i < Object.keys(data.polygons).length - 1 && (
                            <hr className="my-0.5 h-px border-0 bg-zinc-200 dark:bg-zinc-600" />
                          )}
                        </Fragment>
                      ))}
                  </Group>
                </TabPanel>
                <TabPanel id="reference">
                  {referenceLayers.length > 0 ? (
                    <>
                      <ReferenceData layers={referenceLayers} currentMapScale={currentMapScale ?? 0} />
                      <ReferenceLabelSwitch layers={referenceLayers}>Labels</ReferenceLabelSwitch>
                    </>
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
