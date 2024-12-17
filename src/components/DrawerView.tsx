import { useContext } from 'react';
import { GeneralView, ProjectSpecificView } from './';
import { ProjectContext } from './contexts';

export const DrawerView = () => {
  const context = useContext(ProjectContext);
  let projectId = 0;

  if (context) {
    projectId = context.projectId ?? 0;
  }

  if (projectId > 0) {
    return <ProjectSpecificView projectId={projectId} />;
  }

  return <GeneralView />;
};
