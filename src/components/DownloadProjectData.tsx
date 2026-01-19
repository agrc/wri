import { submitJob } from '@arcgis/core/rest/geoprocessor.js';
import DataFile from '@arcgis/core/rest/support/DataFile';
import { useMutation } from '@tanstack/react-query';
import { Button, Spinner } from '@ugrc/utah-design-system';
import { Download } from 'lucide-react';

const GP_URL = `${import.meta.env.VITE_GIS_BASE_URL}/arcgis/rest/services/WRI/ToolboxAsync/GPServer/Download`;

type DownloadProjectDataProps = {
  projectId: number;
  /** Override the download function for testing/stories */
  downloadFn?: (projectId: number) => Promise<string>;
};

async function executeDownload(projectId: number): Promise<string> {
  const jobInfo = await submitJob(GP_URL, {
    project_ids: String(projectId),
  });

  await jobInfo.waitForJobCompletion();

  if (jobInfo.jobStatus === 'job-succeeded') {
    const result = await jobInfo.fetchResultData('output');
    const url = (result.value as DataFile).url;

    if (!url) {
      throw new Error('Download URL not returned from geoprocessing service');
    }

    return url;
  }

  throw new Error(`Geoprocessing job failed with status: ${jobInfo.jobStatus}`);
}

export function DownloadProjectData({ projectId, downloadFn }: DownloadProjectDataProps) {
  const { data, error, mutate, isPending } = useMutation({
    mutationFn: () => (downloadFn ?? executeDownload)(projectId),
  });

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Button variant="secondary" className="w-full" onPress={() => mutate()} isDisabled={isPending}>
        {isPending ? (
          <>
            <div className="size-5">
              <Spinner />
            </div>
            <span className="ml-2">Preparing download...</span>
          </>
        ) : (
          <span className="ml-2">Request file geodatabase</span>
        )}
      </Button>
      {data && (
        <a className="flex items-center justify-center gap-2" href={data} target="_blank" rel="noopener noreferrer">
          <Download className="size-4" />
          Download ZIP
        </a>
      )}
      {error && (
        <div className="text-sm text-red-500">
          {error instanceof Error ? error.message : 'Failed to generate download'}
        </div>
      )}
    </div>
  );
}
