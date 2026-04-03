import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, useFirebaseFunctions } from '@ugrc/utah-design-system';
import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';
import { getUserCredentials } from '../utils/userCredentials';
import { ErrorBanner } from './ErrorBanner';

type Props = {
  projectId: number;
  allowEdits: boolean;
};

export const UpdateProjectStatistics = ({ projectId, allowEdits }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const { functions } = useFirebaseFunctions();
  functions.region = 'us-west3';
  const updateProjectStatsFn = httpsCallable(functions, 'updateProjectStats');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const credentials = getUserCredentials();
      await updateProjectStatsFn({ projectId, ...credentials });
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
