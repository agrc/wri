import { useState } from 'react';
import { LayerViewContext } from '.';

export const LayerViewProvider = ({ children }: { children: React.ReactNode }) => {
  const [projectId, setProjectId] = useState<number | null>(null);

  return (
    <LayerViewContext.Provider
      value={{
        projectId,
        setProjectId,
      }}
    >
      {children}
    </LayerViewContext.Provider>
  );
};
