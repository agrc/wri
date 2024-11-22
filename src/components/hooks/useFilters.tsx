import { useContext } from 'react';
import { FilterContext } from '../contexts';

export const useFilters = () => {
  const context = useContext(FilterContext);

  if (context === null) {
    throw new Error('useFilters must be used within a FilterContext');
  }

  return context;
};
