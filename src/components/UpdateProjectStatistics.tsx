import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@ugrc/utah-design-system/src/components/Button';
import type { UpdateProjectStatsRequest, UpdateProjectStatsResponse } from '@ugrc/wri-shared/types';
import { useState } from 'react';
import { useAuthedCallable } from '../hooks/useTypedCallable';
import { ErrorBanner } from './ErrorBanner';

type Props = {
  projectId: number;
  allowEdits: boolean;
};

export const UpdateProjectStatistics = ({ projectId, allowEdits }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const updateProjectStatsFn = useAuthedCallable<UpdateProjectStatsRequest, UpdateProjectStatsResponse>(
    'updateProjectStats',
  );
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      await updateProjectStatsFn({ projectId });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err) => setError(err.message ?? 'Failed to update project statistics'),
  });

  if (!allowEdits) return null;

  return (
    <>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <Button
        variant="secondary"
        className="w-full"
        isDisabled={mutation.isPending}
        isPending={mutation.isPending}
        onPress={() => mutation.mutate()}
      >
        Update statistics
      </Button>
    </>
  );
};
