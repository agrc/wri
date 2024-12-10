import { Tab, TabList, TabPanel, Tabs } from '@ugrc/utah-design-system';
import { Group } from 'react-aria-components';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from './ErrorFallBack';

export const ProjectSpecificView = ({ projectId }: { projectId: number }) => {
  return (
    <div className="mx-2 mb-2 grid grid-cols-1 gap-2">
      <h2 className="text-xl font-bold dark:text-zinc-200">Project {projectId}</h2>
      <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Tabs>
            <TabList aria-label="Project details">
              <Tab id="details">Details</Tab>
            </TabList>
            <TabPanel id="details">
              <Group className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
                  <h5 className="dark:text-zinc-200">Project Status</h5>
                </div>
                <div className="flex flex-col gap-4 rounded border border-zinc-200 p-3 dark:border-zinc-700">
                  <h5 className="dark:text-zinc-200">Project Status</h5>
                </div>
              </Group>
            </TabPanel>
          </Tabs>
        </ErrorBoundary>
      </div>
    </div>
  );
};
