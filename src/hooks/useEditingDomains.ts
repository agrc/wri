import { useQuery } from '@tanstack/react-query';
import type { EditingDomainsResponse } from '@ugrc/wri-shared/types';
import { useCallback } from 'react';
import { useCallableData } from './useTypedCallable';

export const useEditingDomains = (enabled: boolean) => {
  const editingDomainsFn = useCallableData<void, EditingDomainsResponse>('editingDomains');
  const loadEditingDomains = useCallback(async () => editingDomainsFn(undefined), [editingDomainsFn]);

  return useQuery({
    queryKey: ['editingDomains'],
    queryFn: loadEditingDomains,
    enabled,
    staleTime: Infinity,
  });
};
