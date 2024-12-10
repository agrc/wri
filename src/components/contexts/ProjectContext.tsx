import { createContext } from 'react';

export const ProjectContext = createContext<{
  projectId: number | null;
  setProjectId: (projectId: number | null) => void;
} | null>(null);
