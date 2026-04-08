const HERBICIDE_ACTION_NAME = 'herbicide application';

export const isHerbicideAction = (action: string) => action.trim().toLowerCase() === HERBICIDE_ACTION_NAME;

export const shouldShowHerbicideField = (action: string, treatment: string, herbicideCount: number) =>
  isHerbicideAction(action) && treatment.trim().length > 0 && herbicideCount > 0;

export const hasRequiredHerbicideSelections = (
  action: string,
  treatment: string,
  herbicides: string[],
  herbicideCount: number,
) => {
  if (!shouldShowHerbicideField(action, treatment, herbicideCount)) {
    return true;
  }

  return herbicides.length > 0 && herbicides.every((herbicide) => herbicide.trim().length > 0);
};
