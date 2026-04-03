import { useQuery } from '@tanstack/react-query';
import { useFirebaseFunctions } from '@ugrc/utah-design-system';
import { httpsCallable } from 'firebase/functions';
import type { EditingDomainsResponse } from '../types';

export const useEditingDomains = (enabled: boolean) => {
  const { functions } = useFirebaseFunctions();
  functions.region = 'us-west3';
  const editingDomainsFn = httpsCallable(functions, 'editingDomains');

  return useQuery({
    queryKey: ['editingDomains'],
    queryFn: async () => {
      const result = await editingDomainsFn();
      return result.data as EditingDomainsResponse;
    },
    enabled,
    staleTime: Infinity,
  });
};
