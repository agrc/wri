import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DownloadProjectData } from './DownloadProjectData';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const meta = {
  title: 'Components/DownloadProjectData',
  component: DownloadProjectData,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-[270px]">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof DownloadProjectData>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default idle state - click to trigger download */
export const Default: Story = {
  args: {
    projectId: 12345,
    downloadFn: () =>
      new Promise((resolve) => {
        setTimeout(() => resolve('https://example.com/download/project-12345.zip'), 2000);
      }),
  },
};

/** Shows the loading spinner while the geoprocessing job is running */
export const Loading: Story = {
  args: {
    projectId: 12345,
    downloadFn: () => new Promise(() => {}), // Never resolves to show loading state
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button');
    button?.click();
  },
};

/** Shows the download link after successful completion */
export const Success: Story = {
  args: {
    projectId: 12345,
    downloadFn: () => Promise.resolve('https://example.com/download/project-12345.zip'),
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button');
    button?.click();
  },
};

/** Shows error message when the geoprocessing job fails */
export const ErrorState: Story = {
  args: {
    projectId: 12345,
    downloadFn: () => Promise.reject(new Error('Geoprocessing job failed with status: job-failed')),
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button');
    button?.click();
  },
};

/** Shows a generic error when no message is available */
export const GenericError: Story = {
  args: {
    projectId: 12345,
    downloadFn: () => Promise.reject('Unknown error'),
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button');
    button?.click();
  },
};
