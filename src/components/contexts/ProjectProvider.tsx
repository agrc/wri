import { useState } from 'react';
import { ProjectContext } from '.';

export const ProjectProvider = ({ children }: { children: React.ReactNode }) => {
  const [projectId, setProjectId] = useState<number | null>(null);

  return (
    <ProjectContext.Provider
      value={{
        projectId,
        setProjectId,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};
