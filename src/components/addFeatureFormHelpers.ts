const HERBICIDE_ACTION_NAME = 'herbicide application';

export const isHerbicideAction = (action: string) => action.trim().toLowerCase() === HERBICIDE_ACTION_NAME;

export const shouldShowHerbicideField = (action: string, treatment: string, herbicideCount: number) =>
  isHerbicideAction(action) && treatment.trim().length > 0 && herbicideCount > 0;
