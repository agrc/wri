import { GeneralView, ProjectSpecificView } from './';

export const DrawerView = ({ projectId }: { projectId: number }) => {
  if (projectId > 0) {
    return <ProjectSpecificView projectId={projectId} />;
  }

  return <GeneralView />;
};
