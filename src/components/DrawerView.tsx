import { GeneralView, ProjectSpecificView } from './';

export const DrawerView = ({ projectId }: { projectId: number | null }) => {
  if (projectId) {
    return <ProjectSpecificView projectId={projectId} />;
  }

  return <GeneralView />;
};
