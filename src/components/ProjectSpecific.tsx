import { useQuery } from '@tanstack/react-query';
import { Tab, TabList, TabPanel, Tabs } from '@ugrc/utah-design-system';
import ky from 'ky';
import { Group } from 'react-aria-components';
import { List } from 'react-content-loader';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './ErrorFallBack';

export const ProjectSpecificView = ({ projectId }: { projectId: number }) => {
  const { data, status } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await ky
        .get(`http://127.0.0.1:5001/ut-dts-agrc-wri-dev/us-central1/project?id=${projectId}`)
        .json();

      if (response.length === 0) {
        throw new Error('No project found');
      }

      return response[0];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return (
    <div className="mx-2 mb-2 grid grid-cols-1 gap-2 dark:text-zinc-200">
      <h2 className="text-xl font-bold">Project {projectId}</h2>
      <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="flex justify-between">
            <p>Project Name</p>
            <p>Project Status</p>
          </div>
          {status === 'pending' && <List className="w-96" />}
          {status === 'success' && (
            <Tabs>
              <TabList aria-label="Project details">
                <Tab id="details">Details</Tab>
              </TabList>
              <TabPanel id="details">
                <Group className="flex flex-col gap-2 dark:text-zinc-200">
                  <div className="[&>p:first-child]:font-bold">
                    <p>Description</p>
                    <p></p>
                  </div>
                  <div className="flex gap-2 [&>p:first-child]:font-bold">
                    <p>Project manager</p>
                    <p>{data.ProjectManagerName}</p>
                  </div>
                  <div className="flex gap-2 [&>p:first-child]:font-bold">
                    <p>Lead agency</p>
                    <p>{data.LeadAgencyOrg}</p>
                  </div>
                  <div className="flex gap-2 [&>p:first-child]:font-bold">
                    <p>Region</p>
                    <p>{data.ProjRegion}</p>
                  </div>
                  <div className="flex gap-2 [&>p:first-child]:font-bold">
                    <p>Terrestrial acres</p>
                    <p>{data.TerrestrialSqMeters}</p>
                  </div>
                  <div className="flex gap-2 [&>p:first-child]:font-bold">
                    <p>County</p>
                    <p>County</p>
                  </div>
                  <div className="flex gap-2 [&>p:first-child]:font-bold">
                    <p>Land ownership</p>
                    <p>Land ownership</p>
                  </div>
                </Group>
              </TabPanel>
            </Tabs>
          )}
          <ul>
            <li>Feature Type</li>
            <ul>
              <li>Bullhog</li>
            </ul>
          </ul>
        </ErrorBoundary>
      </div>
    </div>
  );
};
