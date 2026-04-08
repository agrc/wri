import { useQuery } from '@tanstack/react-query';
import type { EditingDomainsResponse } from '@ugrc/wri-shared/types';
import { useCallableData } from './useTypedCallable';

export const useEditingDomains = (enabled: boolean) => {
  const editingDomainsFn = useCallableData<void, EditingDomainsResponse>('editingDomains');

  return useQuery({
    queryKey: ['editingDomains'],
    queryFn: async () => editingDomainsFn(undefined),
    enabled,
    staleTime: Infinity,
  });
};
